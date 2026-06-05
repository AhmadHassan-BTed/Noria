import streamlit as st
import os
import shutil
import subprocess
import signal
import time
from ui.state import (
    load_running_processes,
    load_profiles,
    save_running_processes,
    PROFILE_FILE,
    CREATED_SCANS_FILE,
    PROCESS_FILE
)

def is_windows_startup_enabled():
    if os.name != 'nt':
        return False
    appdata = os.environ.get("APPDATA")
    if not appdata:
        return False
    shortcut_path = os.path.join(appdata, r"Microsoft\Windows\Start Menu\Programs\Startup", "Noria.lnk")
    return os.path.exists(shortcut_path)

def set_windows_startup(enabled: bool):
    if os.name != 'nt':
        return False
    
    appdata = os.environ.get("APPDATA")
    if not appdata:
        st.error("Could not locate APPDATA directory.")
        return False
        
    workspace_dir = os.path.abspath(os.getcwd())
    exe_path = os.path.join(workspace_dir, "dist", "Noria.exe")
    shortcut_path = os.path.join(appdata, r"Microsoft\Windows\Start Menu\Programs\Startup", "Noria.lnk")
    
    if enabled:
        if not os.path.exists(exe_path):
            st.error(f"Could not find compiled Noria.exe at: {exe_path}. Please build the executable first.")
            return False
            
        ps_script = f"""
        $WshShell = New-Object -ComObject WScript.Shell
        $Shortcut = $WshShell.CreateShortcut('{shortcut_path}')
        $Shortcut.TargetPath = '{exe_path}'
        $Shortcut.WorkingDirectory = '{workspace_dir}'
        $Shortcut.Description = 'Noria Agentic Control Center'
        $Shortcut.Save()
        """
        try:
            subprocess.run(["powershell", "-Command", ps_script], capture_output=True, check=True)
            return True
        except Exception as e:
            st.error(f"Failed to enable startup: {e}")
            return False
    else:
        if os.path.exists(shortcut_path):
            try:
                os.remove(shortcut_path)
                return True
            except Exception as e:
                st.error(f"Failed to disable startup: {e}")
                return False
        return True

def reset_application_data():
    # 1. Stop all active background processes
    running_instances = load_running_processes()
    stopped_count = 0
    for name, info in list(running_instances.items()):
        try:
            if os.name == 'nt':
                subprocess.run(['taskkill', '/F', '/T', '/PID', str(info['pid'])], capture_output=True)
            else:
                os.kill(info['pid'], signal.SIGTERM)
            stopped_count += 1
        except Exception:
            pass
            
    # 2. Clear out the data folder files
    if os.path.exists("data"):
        for f in os.listdir("data"):
            file_path = os.path.join("data", f)
            try:
                if os.path.isfile(file_path):
                    os.remove(file_path)
                elif os.path.isdir(file_path):
                    shutil.rmtree(file_path)
            except Exception:
                pass
                
    # 3. Remove wwebjs sessions & caches
    for folder in [".wwebjs_auth", ".wwebjs_cache"]:
        if os.path.exists(folder):
            try:
                shutil.rmtree(folder)
            except Exception:
                pass
                
    # 4. Save empty running processes list
    save_running_processes({})
    
    # 5. Reinitialize profiles list with default settings
    load_profiles()
    
    return stopped_count

def render_settings_view():
    st.title("⚙️ Control Center Settings")
    st.caption("Configure local system integrations, manage data persistence, and clear system cache.")

    # 1. Startup settings
    st.markdown("#### 🚀 System Boot & Startup")
    with st.container(border=True):
        st.markdown("""
        **Run Noria on Windows Startup**  
        Automatically start the Noria Control Center when you log into Windows. This ensures your opportunity extraction scans resume running in the background.
        """)
        
        if os.name != 'nt':
            st.info("System startup toggle is only supported on Windows installations.")
        else:
            is_enabled = is_windows_startup_enabled()
            startup_toggle = st.toggle(
                "Enable Run at Startup",
                value=is_enabled,
                key="noria_startup_toggle_key"
            )
            
            if startup_toggle != is_enabled:
                if set_windows_startup(startup_toggle):
                    if startup_toggle:
                        st.toast("Noria will now start automatically on Windows boot!")
                    else:
                        st.toast("Startup shortcut removed.")
                    time.sleep(0.5)
                    st.rerun()

    # 2. Data management
    st.markdown("#### 💾 Local Data Retention & Clean Reset")
    with st.container(border=True):
        st.markdown("""
        **Reset Application Data**  
        This will stop all running scan daemons and completely reset Noria to a fresh installation:
        * Deletes all created **Applicant Profiles** and credentials.
        * Resets and clears all configured **Opportunity Scan Pills**.
        * Logs out all linked **WhatsApp Devices** (clearing session cookies).
        * Wipes all historical **Opportunity Evaluation Feeds** and daemon log files.
        """)
        
        st.warning("⚠️ **Warning:** This action is irreversible. All your local data will be permanently wiped.")
        
        if st.button("🗑️ Clear All Application Data", type="primary", use_container_width=True):
            with st.spinner("Stopping active daemons and wiping local storage..."):
                stopped_instances = reset_application_data()
                st.success(f"Successfully stopped {stopped_instances} active scan(s) and reset all data files.")
                time.sleep(1.5)
                st.rerun()
