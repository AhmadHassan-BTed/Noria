import streamlit as st
import subprocess
import os
import json
import time
import signal
from PIL import Image
import io

# Optional qrcode import fallback
try:
    import qrcode
    HAS_QRCODE = True
except ImportError:
    HAS_QRCODE = False

# =============================================================================
# Streamlit Page Config & Custom Styling (Apple Aesthetics)
# =============================================================================
st.set_page_config(
    page_title="Noria — Control Center",
    page_icon="📡",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Minimalist CSS to make sidebar navigation buttons full-width and left-aligned
st.markdown("""
<style>
    [data-testid="stSidebar"] div.stButton > button {
        width: 100% !important;
        text-align: left !important;
    }
</style>
""", unsafe_allow_html=True)

# Ensure data directory exists
os.makedirs("data", exist_ok=True)

PROCESS_FILE = "data/processes.json"
PROFILE_FILE = "data/profiles.json"

PREDEFINED_SCANS = {
    "daad_scholarships": {
        "name": "DAAD Germany Scholarships",
        "category": "Scholarships Discovery",
        "template": "scholarships",
        "channels": "DAAD Scholarship Alerts, Germany Study News, Pakistan Germany Student Network",
        "description": "Monitors German academic channels for master's and PhD scholarships."
    },
    "erasmus_scholarships": {
        "name": "Erasmus Mundus Coordinator",
        "category": "Scholarships Discovery",
        "template": "scholarships",
        "channels": "Erasmus Mundus Official, EU Scholarships Info, Erasmus Mundus Association",
        "description": "Evaluates fully funded Erasmus Mundus Joint Master's scholarship alerts."
    },
    "fulbright_scholarships": {
        "name": "US Fulbright Updates",
        "category": "Scholarships Discovery",
        "template": "scholarships",
        "channels": "USEFP Fulbright Updates, US Scholarships, Fulbright Alumni Network",
        "description": "Tracks US Fulbright scholarship calls and application guides."
    },
    "remote_react_dev": {
        "name": "Remote React/Node Developer Jobs",
        "category": "Job Search & Match",
        "template": "jobs",
        "channels": "JS Jobs Portal, Remote Web Dev Jobs, React Developer Opportunities",
        "description": "Scrapes and evaluates remote JS/TS, React, and Node.js roles."
    },
    "ai_ml_internships": {
        "name": "AI/ML Research & Engineering Internships",
        "category": "Job Search & Match",
        "template": "jobs",
        "channels": "AI Research Alerts, Deep Learning Internships, Machine Learning Careers",
        "description": "Monitors machine learning and artificial intelligence internship opportunities."
    }
}


# =============================================================================
# Helper Utilities
# =============================================================================
CREATED_SCANS_FILE = "data/created_scans.json"

def load_created_scans():
    if os.path.exists(CREATED_SCANS_FILE):
        try:
            with open(CREATED_SCANS_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_created_scans(scans):
    try:
        with open(CREATED_SCANS_FILE, "w") as f:
            json.dump(scans, f, indent=2)
    except Exception as e:
        st.error(f"Failed to persist created scans: {e}")

def load_profiles():
    profiles = {}
    if os.path.exists(PROFILE_FILE):
        try:
            with open(PROFILE_FILE, "r") as f:
                profiles = json.load(f)
        except Exception:
            profiles = {}
    
    # Auto-seed from existing .env if present
    if not profiles:
        env_data = {}
        if os.path.exists(".env"):
            try:
                with open(".env", "r") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            env_data[k.strip()] = v.strip()
            except Exception:
                pass
            
        profiles = {
            "default": {
                "id": "default",
                "name": "Default Profile",
                "gemini_key": env_data.get("GEMINI_API_KEY", ""),
                "jina_key": env_data.get("JINA_API_KEY", ""),
                "applicant_name": env_data.get("APPLICANT_NAME", "Ahmad Hassan"),
                "applicant_nationality": env_data.get("APPLICANT_NATIONALITY", "Pakistani"),
                "applicant_degree_tier": env_data.get("APPLICANT_DEGREE_TIER", "BS Software Engineering (8th Sem)"),
                "applicant_target_fields": env_data.get("APPLICANT_TARGET_FIELDS", "Software Engineering, AI"),
                "applicant_focus": env_data.get("APPLICANT_RESEARCH_FOCUS", "Federated Learning, AI"),
                "devices": {}
            }
        }
        
        try:
            with open(PROFILE_FILE, "w") as f:
                json.dump(profiles, f, indent=2)
        except Exception:
            pass
            
    # Ensure "devices" dictionary exists for all profiles
    changed = False
    for p_id in profiles:
        if "devices" not in profiles[p_id]:
            profiles[p_id]["devices"] = {}
            changed = True
    if changed:
        try:
            with open(PROFILE_FILE, "w") as f:
                json.dump(profiles, f, indent=2)
        except Exception:
            pass
        
    return profiles

def save_profiles(profiles):
    try:
        with open(PROFILE_FILE, "w") as f:
            json.dump(profiles, f, indent=2)
    except Exception as e:
        st.error(f"Failed to persist profiles: {e}")

def load_running_processes():
    if os.path.exists(PROCESS_FILE):
        try:
            with open(PROCESS_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_running_processes(processes):
    try:
        with open(PROCESS_FILE, "w") as f:
            json.dump(processes, f, indent=2)
    except Exception as e:
        st.error(f"Failed to persist processes state: {e}")

def get_session_status(session_id):
    status_path = f"data/status-{session_id}.json"
    if os.path.exists(status_path):
        try:
            with open(status_path, "r") as f:
                return json.load(f)
        except Exception:
            return {"status": "UNKNOWN"}
    return {"status": "DISCONNECTED"}

def is_process_alive(pid):
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False

# Clean zombie process entries
running_instances = load_running_processes()
cleaned = {}
for name, info in running_instances.items():
    if is_process_alive(info["pid"]):
        cleaned[name] = info
    else:
        # Delete related QR/Status files if crashed/stopped
        try:
            os.remove(f"data/qr-{info['sessionId']}.txt")
        except FileNotFoundError:
            pass
        try:
            os.remove(f"data/status-{info['sessionId']}.json")
        except FileNotFoundError:
            pass
if len(cleaned) != len(running_instances):
    save_running_processes(cleaned)
    running_instances = cleaned

# Initialize session states for inline active scans and add forms tracking
if "focused_scan" not in st.session_state:
    st.session_state.focused_scan = {}
if "show_add_scan" not in st.session_state:
    st.session_state.show_add_scan = {}
if "linking_profile" not in st.session_state:
    st.session_state.linking_profile = None
if "linker_sess_id" not in st.session_state:
    st.session_state.linker_sess_id = None

# Initialize active page state
if "current_page" not in st.session_state:
    st.session_state.current_page = "Profiles"

# =============================================================================
# Sidebar Navigation Panel (Clean SaaS Layout)
# =============================================================================
st.sidebar.title("📡 NORIA v2")
st.sidebar.caption("SaaS Orchestration Console")
st.sidebar.write("---")

# Styled Sidebar Buttons for Navigation
if st.sidebar.button("👤 Applicant Profiles", use_container_width=True, type="primary" if st.session_state.current_page == "Profiles" else "secondary"):
    st.session_state.current_page = "Profiles"
    st.rerun()

if st.sidebar.button("📡 Opportunity Scans", use_container_width=True, type="primary" if st.session_state.current_page == "Scans" else "secondary"):
    st.session_state.current_page = "Scans"
    st.rerun()

st.sidebar.write("---")
st.sidebar.info("Manage independent customer profiles, API keys, and launch dynamic opportunity scans entirely from the unified profile directory.")

# =============================================================================
# Main View: SaaS Applicant Profiles Directory
# =============================================================================
profiles = load_profiles()

if st.session_state.current_page == "Scans":
    st.title("Opportunity Scans Dashboard")
    st.write("Monitor all active opportunity search pipelines or launch new sandboxed scanning sessions.")
    st.write("---")
    
    # 1. Master List of Active Scans
    st.subheader("📡 Active Opportunity Scans")
    
    if not running_instances:
        st.info("No active opportunity scans are running in the system. Use the launchpad below to start one.")
    else:
        # Display as a neat list of container cards
        for scan_name, info in sorted(running_instances.items()):
            with st.container(border=True):
                col_info, col_status, col_action = st.columns([3, 1, 1])
                with col_info:
                    st.markdown(f"#### `{scan_name}`")
                    st.markdown(f"""
                    * **Powered By Profile:** {info['profileName']} (`{info['profileId']}`)
                    * **Pipeline Category:** {info['category']}
                    * **Monitored Channels:** `{info.get('channels') or 'All subscribed links'}`
                    * **Target Phone:** `{info['phone'] or 'Default target'}`
                    * **Started At:** {info['startedAt']}
                    """)
                with col_status:
                    status_info = get_session_status(info["sessionId"])
                    scan_status = status_info.get("status", "UNKNOWN")
                    if scan_status == "CONNECTED":
                        st.success("Linked & Active")
                    elif scan_status == "SCAN_QR":
                        st.warning("Awaiting Scan")
                    else:
                        st.info(scan_status)
                        
                with col_action:
                    if st.button("Stop Scan", key=f"stop_global_{scan_name}", use_container_width=True):
                        try:
                            if os.name == 'nt':
                                subprocess.run(['taskkill', '/F', '/T', '/PID', str(info['pid'])], capture_output=True)
                            else:
                                os.kill(info['pid'], signal.SIGTERM)
                            
                            # Evict process details
                            del running_instances[scan_name]
                            save_running_processes(running_instances)
                            st.toast(f"Scan '{scan_name}' stopped successfully.")
                            time.sleep(1)
                            st.rerun()
                        except Exception as e:
                            st.error(f"Failed to terminate process: {e}")

    st.write("---")
    
    # 2. Master Form to Launch a New Scan
    st.subheader("🚀 Launch New Opportunity Scan")
    
    if not profiles:
        st.warning("You must create an Applicant Profile first before you can launch an opportunity scan.")
    else:
        with st.container(border=True):
            selected_p_id = st.selectbox(
                "Select Applicant Profile to Power Scan",
                options=list(profiles.keys()),
                format_func=lambda x: profiles[x]["name"],
                key="global_scan_profile_selector"
            )
            selected_profile = profiles[selected_p_id]
            
            # Show a brief summary card of selected profile credentials/target
            st.markdown(f"**Selected Profile Target Fields:** `{selected_profile.get('applicant_target_fields', 'Not set')}`")
            
            st.write("---")
            
            global_scan_mode = st.radio(
                "Choose Scan Configuration Method",
                ["Select Predefined Scan", "Create Custom Scan"],
                horizontal=True,
                key="global_scan_mode"
            )
            
            if global_scan_mode == "Select Predefined Scan":
                selected_predef_key = st.selectbox(
                    "Available Opportunity Scans",
                    options=list(PREDEFINED_SCANS.keys()),
                    format_func=lambda x: PREDEFINED_SCANS[x]["name"],
                    key="global_predef_select",
                    help="Choose a preconfigured scan targeting popular academic or job channels."
                )
                selected_scan_info = PREDEFINED_SCANS[selected_predef_key]
                
                with st.container(border=True):
                    st.markdown(f"**Description:** {selected_scan_info['description']}")
                    st.markdown(f"**Pipeline Category:** `{selected_scan_info['category']}`")
                    st.markdown(f"**Channels to Monitor:** `{selected_scan_info['channels']}`")
                
                global_phone = st.text_input(
                    "Notification Target Phone",
                    placeholder="e.g. +923001234567",
                    key="global_phone_predef",
                    help="Phone number to receive matching opportunity notifications via WhatsApp."
                ).strip()
                
                global_category = selected_scan_info["category"]
                global_template = selected_scan_info["template"]
                global_scan_name = selected_predef_key
                global_channels = selected_scan_info["channels"]
                
            else:
                global_category = st.selectbox(
                    "Select Opportunity Pipeline",
                    ["Scholarships Discovery", "Job Search & Match"],
                    key="global_cat_selector",
                    help="Select the classification type of opportunities you want to search and evaluate."
                )
                global_template = "scholarships" if global_category == "Scholarships Discovery" else "jobs"
                
                global_scan_name = st.text_input(
                    "Name this Scan",
                    placeholder="e.g. scholarship_europe, jobs_germany",
                    key="global_scan_name_input",
                    help="A unique name to identify this scan instance."
                ).strip().replace(" ", "_")

                global_phone = st.text_input(
                    "Notification Target Phone",
                    placeholder="e.g. +923001234567",
                    key="global_phone_input",
                    help="Phone number to receive matching opportunity notifications via WhatsApp."
                ).strip()

                global_channels = st.text_area(
                    "WhatsApp Channels to Monitor (Comma separated)",
                    placeholder="e.g. Scholarship Alerts, 923009876543@newsletter",
                    key="global_channels_input",
                    help="Specify names or IDs of subscribed WhatsApp Channels. Leave blank to process all incoming links."
                )

            global_sess_id = f"session_{selected_p_id}"

            if st.button("Launch Scan", type="primary", use_container_width=True):
                if not global_scan_name:
                    st.error("Please enter a name for this scan.")
                else:
                    # Auto-suffix to avoid collision if running predefined/duplicate named scan
                    actual_scan_name = global_scan_name
                    if actual_scan_name in running_instances:
                        suffix = 2
                        candidate_name = f"{actual_scan_name}_{suffix}"
                        while candidate_name in running_instances:
                            suffix += 1
                            candidate_name = f"{actual_scan_name}_{suffix}"
                        actual_scan_name = candidate_name
                    
                    # Launch process
                    cmd = [
                        "node", "src/launcher.js",
                        "--template", global_template,
                        "--instance", actual_scan_name,
                        "--sessionId", global_sess_id
                    ]
                    if global_channels:
                        cmd.extend(["--channels", global_channels])
                    if global_phone:
                        cmd.extend(["--phone", global_phone])

                    custom_env = os.environ.copy()
                    custom_env.update({
                        "GEMINI_API_KEY": selected_profile["gemini_key"],
                        "JINA_API_KEY": selected_profile.get("jina_key", ""),
                        "APPLICANT_NAME": selected_profile["applicant_name"],
                        "APPLICANT_NATIONALITY": selected_profile["applicant_nationality"],
                        "APPLICANT_DEGREE_TIER": selected_profile["applicant_degree_tier"],
                        "APPLICANT_TARGET_FIELDS": selected_profile["applicant_target_fields"],
                        "APPLICANT_RESEARCH_FOCUS": selected_profile.get("applicant_focus", selected_profile.get("applicant_research_focus", ""))
                    })

                    try:
                        p = subprocess.Popen(
                            cmd,
                            stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL,
                            env=custom_env,
                            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
                        )
                        
                        running_instances[actual_scan_name] = {
                            "pid": p.pid,
                            "template": global_template,
                            "category": global_category,
                            "sessionId": global_sess_id,
                            "profileId": selected_p_id,
                            "profileName": selected_profile["name"],
                            "channels": global_channels,
                            "phone": global_phone,
                            "startedAt": time.strftime("%Y-%m-%d %H:%M:%S")
                        }
                        save_running_processes(running_instances)
                        
                        st.success(f"Scan '{actual_scan_name}' launched successfully with PID {p.pid}.")
                        time.sleep(1)
                        st.rerun()
                    except Exception as e:
                        st.error(f"Failed to launch scan process: {e}")
    st.stop()

# =============================================================================
# Main View: SaaS Applicant Profiles Directory (Default Page)
# =============================================================================
st.title("Applicant Profiles")
st.write("Manage independent customer profiles, configure API keys, and monitor WhatsApp account linking states.")
st.write("---")

editing_profile = st.session_state.get("editing_profile", None)

if editing_profile is None:
    # Directory View
    cols = st.columns([5, 1])
    with cols[0]:
        st.write(f"Registered Customer Profiles: **{len(profiles)}**")
    with cols[1]:
        if st.button("➕ Add Profile", use_container_width=True):
            st.session_state.editing_profile = "new"
            st.rerun()
    
    st.write("")

    if not profiles:
        st.info("No applicant profiles registered yet. Click 'Add Profile' to create one.")
    else:
        # Display all profiles as dynamic native cards
        for p_id, p_info in sorted(profiles.items()):
            with st.container(border=True):
                # Profile Card Header & Quick Actions
                card_header_cols = st.columns([4, 1, 1])
                with card_header_cols[0]:
                    st.markdown(f"### 👤 {p_info['name']}")
                with card_header_cols[1]:
                    if st.button("✏️ Edit", key=f"edit_btn_{p_id}", use_container_width=True):
                        st.session_state.editing_profile = p_id
                        st.rerun()
                with card_header_cols[2]:
                    if st.button("🗑️ Delete", key=f"delete_btn_{p_id}", use_container_width=True):
                        if p_id == "default":
                            st.error("The Default Profile cannot be deleted.")
                        else:
                            del profiles[p_id]
                            save_profiles(profiles)
                            st.toast(f"Profile '{p_info['name']}' deleted.")
                            time.sleep(1)
                            st.rerun()
                
                st.write("---")
                
                # Profile Details & Status columns
                details_col, status_col = st.columns([1, 1])
                
                with details_col:
                    st.markdown("**Profile Parameters**")
                    st.markdown(f"""
                    * **Full Name:** {p_info.get('applicant_name', 'Not set')}
                    * **Nationality:** {p_info.get('applicant_nationality', 'Not set')}
                    * **Degree Tier & Grades:** {p_info.get('applicant_degree_tier', 'Not set')}
                    * **Target Fields:** `{p_info.get('applicant_target_fields', 'Not set')}`
                    * **Research Focus:** `{p_info.get('applicant_focus', p_info.get('applicant_research_focus', 'Not set'))}`
                    """)
                    
                    # API Config Indicator
                    has_gemini = "Yes" if p_info.get("gemini_key") else "No"
                    has_jina = "Yes" if p_info.get("jina_key") else "No"
                    st.markdown(f"**Gemini Configured:** `{has_gemini}` | **Jina Configured:** `{has_jina}`")
                    
                with status_col:
                    st.markdown("**📡 WhatsApp Device Authentications**")
                    
                    linking_active = (st.session_state.linking_profile == p_id)
                    
                    if linking_active:
                        linker_sess_id = st.session_state.linker_sess_id
                        status_info = get_session_status(linker_sess_id)
                        status = status_info.get("status", "UNKNOWN")
                        
                        st.markdown(f"**Connection Linker Status:** `{status}`")
                        
                        if status == "CONNECTED":
                            linked_phone = status_info.get("phone", "")
                            linked_channels = status_info.get("channels", [])
                            
                            if linked_phone:
                                # Ensure devices dict exists
                                if "devices" not in p_info:
                                    p_info["devices"] = {}
                                
                                p_info["devices"][linked_phone] = {
                                    "phone": linked_phone,
                                    "channels": linked_channels,
                                    "linkedAt": time.strftime("%Y-%m-%d %H:%M:%S")
                                }
                                save_profiles(profiles)
                                
                                # Clean stop of helper process
                                linker_proc_info = running_instances.get(linker_sess_id)
                                if linker_proc_info:
                                    try:
                                        if os.name == 'nt':
                                            subprocess.run(['taskkill', '/F', '/T', '/PID', str(linker_proc_info['pid'])], capture_output=True)
                                        else:
                                            os.kill(linker_proc_info['pid'], signal.SIGTERM)
                                    except Exception:
                                        pass
                                    del running_instances[linker_sess_id]
                                    save_running_processes(running_instances)
                                    
                                try:
                                    os.remove(f"data/status-{linker_sess_id}.json")
                                except FileNotFoundError:
                                    pass
                                try:
                                    os.remove(f"data/qr-{linker_sess_id}.txt")
                                except FileNotFoundError:
                                    pass
                                
                                st.session_state.linking_profile = None
                                st.session_state.linker_sess_id = None
                                st.success(f"Device +{linked_phone} linked successfully!")
                                time.sleep(1)
                                st.rerun()
                        
                        elif status == "SCAN_QR":
                            st.warning("Action Required: Scan the QR code below using WhatsApp Linked Devices.")
                            
                            qr_file = f"data/qr-{linker_sess_id}.txt"
                            if os.path.exists(qr_file):
                                try:
                                    with open(qr_file, "r") as f:
                                        qr_data = f.read().strip()
                                    
                                    if HAS_QRCODE:
                                        qr = qrcode.QRCode(version=1, box_size=5, border=2)
                                        qr.add_data(qr_data)
                                        qr.make(fit=True)
                                        qr_img = qr.make_image(fill_color="black", back_color="white")
                                        
                                        buf = io.BytesIO()
                                        try:
                                            qr_img.save(buf, format='PNG')
                                        except TypeError:
                                            qr_img.save(buf)
                                        
                                        st.image(buf.getvalue(), caption="Scan QR Code to Pair Device", width=220)
                                    else:
                                        st.code(qr_data, language="text")
                                except Exception as e:
                                    st.error(f"Failed to render QR: {e}")
                            else:
                                st.info("Loading QR Code from server...")
                                
                        else:
                            st.info("Initializing Linker socket connection...")
                            
                        # Cancel button
                        if st.button("Cancel Pairing", key=f"cancel_pair_{p_id}", use_container_width=True):
                            linker_proc_info = running_instances.get(linker_sess_id)
                            if linker_proc_info:
                                try:
                                    if os.name == 'nt':
                                        subprocess.run(['taskkill', '/F', '/T', '/PID', str(linker_proc_info['pid'])], capture_output=True)
                                    else:
                                        os.kill(linker_proc_info['pid'], signal.SIGTERM)
                                except Exception:
                                    pass
                                del running_instances[linker_sess_id]
                                save_running_processes(running_instances)
                                
                            try:
                                os.remove(f"data/status-{linker_sess_id}.json")
                            except FileNotFoundError:
                                pass
                            try:
                                os.remove(f"data/qr-{linker_sess_id}.txt")
                            except FileNotFoundError:
                                pass
                            
                            st.session_state.linking_profile = None
                            st.session_state.linker_sess_id = None
                            st.rerun()

                        # Lightweight auto-refresh loop to poll connection status
                        time.sleep(2.0)
                        st.rerun()
                            
                    else:
                        devices = p_info.get("devices", {})
                        if not devices:
                            st.info("No active devices linked to this profile.")
                        else:
                            st.success(f"Registered Devices: **{len(devices)}** linked.")
                            for d_phone in sorted(devices.keys()):
                                st.markdown(f"✅ **Device Active:** `+{d_phone}`")
                        
                        st.write("")
                        if st.button("🔗 Link WhatsApp Device", key=f"link_device_btn_{p_id}", use_container_width=True, type="primary"):
                            # Spawn background helper process to retrieve linking details
                            linker_sess_id = f"session_{p_id}_linker_{int(time.time())}"
                            cmd = [
                                "node", "src/launcher.js",
                                "--template", "scholarships",
                                "--instance", linker_sess_id,
                                "--sessionId", linker_sess_id
                            ]
                            
                            custom_env = os.environ.copy()
                            custom_env.update({
                                "GEMINI_API_KEY": p_info["gemini_key"],
                                "JINA_API_KEY": p_info.get("jina_key", ""),
                                "APPLICANT_NAME": p_info["applicant_name"],
                                "APPLICANT_NATIONALITY": p_info["applicant_nationality"],
                                "APPLICANT_DEGREE_TIER": p_info["applicant_degree_tier"],
                                "APPLICANT_TARGET_FIELDS": p_info["applicant_target_fields"],
                                "APPLICANT_RESEARCH_FOCUS": p_info["applicant_focus"]
                            })
                            
                            try:
                                p = subprocess.Popen(
                                    cmd,
                                    stdout=subprocess.DEVNULL,
                                    stderr=subprocess.DEVNULL,
                                    env=custom_env,
                                    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
                                )
                                
                                running_instances[linker_sess_id] = {
                                    "pid": p.pid,
                                    "template": "scholarships",
                                    "category": "Linker",
                                    "sessionId": linker_sess_id,
                                    "profileId": p_id,
                                    "profileName": p_info["name"],
                                    "channels": "",
                                    "phone": "",
                                    "startedAt": time.strftime("%Y-%m-%d %H:%M:%S")
                                }
                                save_running_processes(running_instances)
                                
                                st.session_state.linking_profile = p_id
                                st.session_state.linker_sess_id = linker_sess_id
                                st.rerun()
                            except Exception as e:
                                st.error(f"Failed to spawn linker socket: {e}")
                
                st.write("---")
                
                # Render Sub-cards for Registered Devices
                st.markdown("### 📱 Linked Devices (Sub-cards)")
                devices = p_info.get("devices", {})
                if not devices:
                    st.info("No active devices linked to this profile. Pair a device upfront using the button above.")
                else:
                    dev_cols = st.columns(min(len(devices), 3))
                    for idx, (dev_phone, dev_info) in enumerate(sorted(devices.items())):
                        col_idx = idx % min(len(devices), 3)
                        with dev_cols[col_idx]:
                            with st.container(border=True):
                                st.markdown(f"#### 📱 +{dev_phone}")
                                st.caption(f"Linked: {dev_info.get('linkedAt', 'Unknown')}")
                                st.markdown(f"**Subscribed Channels:** `{len(dev_info.get('channels', []))}`")
                                
                                # Scans running on this device
                                device_scans = [name for name, info in running_instances.items() if info.get("profileId") == p_id and info.get("phone") == dev_phone]
                                
                                if not device_scans:
                                    st.info("No active scans on this device.")
                                else:
                                    st.markdown("**Running Scans:**")
                                    for scan_name in device_scans:
                                        scan_info = running_instances[scan_name]
                                        st.markdown(f"🔸 `{scan_name}` (`{scan_info['category']}`)")
                                        
                                        act_col1, act_col2 = st.columns([1, 1])
                                        with act_col1:
                                            status_info = get_session_status(scan_info["sessionId"])
                                            scan_status = status_info.get("status", "UNKNOWN")
                                            if scan_status == "CONNECTED":
                                                st.success("Active")
                                            else:
                                                st.warning("Connecting")
                                        with act_col2:
                                            if st.button("Stop", key=f"stop_sub_{p_id}_{dev_phone}_{scan_name}", use_container_width=True):
                                                try:
                                                    if os.name == 'nt':
                                                        subprocess.run(['taskkill', '/F', '/T', '/PID', str(scan_info['pid'])], capture_output=True)
                                                    else:
                                                        os.kill(scan_info['pid'], signal.SIGTERM)
                                                    
                                                    del running_instances[scan_name]
                                                    save_running_processes(running_instances)
                                                    st.toast(f"Scan '{scan_name}' stopped successfully.")
                                                    time.sleep(1)
                                                    st.rerun()
                                                except Exception as e:
                                                    st.error(f"Error: {e}")
                                
                                st.write("---")
                                if st.button("Unlink Device", key=f"unlink_{p_id}_{dev_phone}", use_container_width=True):
                                    for scan_name in device_scans:
                                        try:
                                            if os.name == 'nt':
                                                subprocess.run(['taskkill', '/F', '/T', '/PID', str(running_instances[scan_name]['pid'])], capture_output=True)
                                            else:
                                                os.kill(running_instances[scan_name]['pid'], signal.SIGTERM)
                                            del running_instances[scan_name]
                                        except Exception:
                                            pass
                                    save_running_processes(running_instances)
                                    
                                    try:
                                        import shutil
                                        shutil.rmtree(f".wwebjs_auth/session_session_{p_id}_dev_{dev_phone}", ignore_errors=True)
                                    except Exception:
                                        pass
                                        
                                    del p_info["devices"][dev_phone]
                                    save_profiles(profiles)
                                    st.toast("Device unlinked successfully.")
                                    time.sleep(1)
                                    st.rerun()
                
                st.write("---")
                
                # Fetch persistent unassigned scans
                created_scans = load_created_scans()
                user_configured_scans = created_scans.get(p_id, {})
                
                st.markdown("### 🆕 Configured Scans Pool (Pills)")
                
                active_focus = st.session_state.focused_scan.get(p_id, None)
                add_scan_open = st.session_state.show_add_scan.get(p_id, False)
                
                if not user_configured_scans:
                    st.info("No configured scans available. Click '➕ Add Scan' below to create a new scan pill.")
                    
                    # Single Add Scan trigger pill
                    if st.button("➕ Add Scan", key=f"plus_empty_{p_id}", type="primary"):
                        st.session_state.show_add_scan[p_id] = True
                        st.session_state.focused_scan[p_id] = None
                        st.rerun()
                else:
                    tag_col_count = len(user_configured_scans) + 1
                    tag_cols = st.columns(min(tag_col_count, 6))
                    
                    # Render active scan pills
                    for idx, scan_name in enumerate(sorted(user_configured_scans.keys())):
                        col_idx = idx % min(tag_col_count, 6)
                        with tag_cols[col_idx]:
                            is_focused = (active_focus == scan_name)
                            if st.button(
                                f"🏷️ {scan_name}", 
                                key=f"tag_{p_id}_{scan_name}", 
                                type="primary" if is_focused else "secondary",
                                use_container_width=True
                            ):
                                if is_focused:
                                    st.session_state.focused_scan[p_id] = None
                                else:
                                    st.session_state.focused_scan[p_id] = scan_name
                                    st.session_state.show_add_scan[p_id] = False
                                st.rerun()
                                
                    # Render the "+" button
                    plus_col_idx = len(user_configured_scans) % min(tag_col_count, 6)
                    with tag_cols[plus_col_idx]:
                        if st.button(
                            "➕ Add Scan", 
                            key=f"plus_{p_id}", 
                            type="primary" if add_scan_open else "secondary",
                            use_container_width=True
                        ):
                            st.session_state.show_add_scan[p_id] = not add_scan_open
                            st.session_state.focused_scan[p_id] = None
                            st.rerun()
                            
                # Render Inline Scan Details / Device Assignment widget if pill focused
                if active_focus and active_focus in user_configured_scans:
                    scan_cfg = user_configured_scans[active_focus]
                    
                    st.write("")
                    with st.container(border=True):
                        st.markdown(f"#### 🏷️ Configure & Activate Scan: `{active_focus}`")
                        det_cols = st.columns([3, 1])
                        with det_cols[0]:
                            st.markdown(f"""
                            * **Pipeline Category:** {scan_cfg['category']}
                            * **Pipeline Template:** `{scan_cfg['template']}`
                            * **Channels to Monitor:** `{scan_cfg['channels'] or 'All subscribed links'}`
                            """)
                            
                            # Check if scan is active on any device
                            matching_instances = [name for name, info in running_instances.items() if info.get("profileId") == p_id and info.get("template") == scan_cfg["template"] and (name == active_focus or name.startswith(active_focus + "_"))]
                            
                            if matching_instances:
                                running_phones = [running_instances[n]['phone'] for n in matching_instances]
                                st.success(f"This scan is currently active on device(s): **{', '.join(running_phones)}**")
                            else:
                                st.info("This scan pill is currently unassigned (dormant). Select a linked device below to activate it.")
                                
                        with det_cols[1]:
                            if st.button("Delete Scan Pill", key=f"del_pill_{p_id}_{active_focus}", use_container_width=True, type="secondary"):
                                del created_scans[p_id][active_focus]
                                save_created_scans(created_scans)
                                st.session_state.focused_scan[p_id] = None
                                st.toast(f"Scan '{active_focus}' deleted from pool.")
                                time.sleep(1)
                                st.rerun()
                                
                        if not matching_instances:
                            st.write("---")
                            if not devices:
                                st.warning("You must link a WhatsApp device to this profile first before you can activate this scan.")
                            else:
                                activation_col1, activation_col2 = st.columns([3, 1])
                                with activation_col1:
                                    selected_device_phone = st.selectbox(
                                        "Select Device to Activate Scan On",
                                        options=list(devices.keys()),
                                        format_func=lambda x: f"📱 +{x} ({len(devices[x].get('channels', []))} channels)",
                                        key=f"activate_device_{p_id}_{active_focus}"
                                    )
                                with activation_col2:
                                    st.write(" ")
                                    if st.button("🚀 Activate Scan", key=f"btn_activate_{p_id}_{active_focus}", type="primary", use_container_width=True):
                                        device_sess_id = f"session_{p_id}_dev_{selected_device_phone}"
                                        actual_scan_name = active_focus
                                        
                                        # Auto-suffix name if conflict occurs
                                        if actual_scan_name in running_instances:
                                            suffix = 2
                                            candidate_name = f"{actual_scan_name}_{suffix}"
                                            while candidate_name in running_instances:
                                                suffix += 1
                                                candidate_name = f"{actual_scan_name}_{suffix}"
                                            actual_scan_name = candidate_name
                                            
                                        cmd = [
                                            "node", "src/launcher.js",
                                            "--template", scan_cfg["template"],
                                            "--instance", actual_scan_name,
                                            "--sessionId", device_sess_id
                                        ]
                                        if scan_cfg["channels"]:
                                            cmd.extend(["--channels", scan_cfg["channels"]])
                                        cmd.extend(["--phone", selected_device_phone])

                                        custom_env = os.environ.copy()
                                        custom_env.update({
                                            "GEMINI_API_KEY": p_info["gemini_key"],
                                            "JINA_API_KEY": p_info.get("jina_key", ""),
                                            "APPLICANT_NAME": p_info["applicant_name"],
                                            "APPLICANT_NATIONALITY": p_info["applicant_nationality"],
                                            "APPLICANT_DEGREE_TIER": p_info["applicant_degree_tier"],
                                            "APPLICANT_TARGET_FIELDS": p_info["applicant_target_fields"],
                                            "APPLICANT_RESEARCH_FOCUS": p_info["applicant_focus"]
                                        })

                                        try:
                                            p = subprocess.Popen(
                                                cmd,
                                                stdout=subprocess.DEVNULL,
                                                stderr=subprocess.DEVNULL,
                                                env=custom_env,
                                                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
                                            )
                                            
                                            running_instances[actual_scan_name] = {
                                                "pid": p.pid,
                                                "template": scan_cfg["template"],
                                                "category": scan_cfg["category"],
                                                "sessionId": device_sess_id,
                                                "profileId": p_id,
                                                "profileName": p_info["name"],
                                                "channels": scan_cfg["channels"],
                                                "phone": selected_device_phone,
                                                "startedAt": time.strftime("%Y-%m-%d %H:%M:%S")
                                            }
                                            save_running_processes(running_instances)
                                            
                                            st.success(f"Scan '{actual_scan_name}' activated on device +{selected_device_phone}.")
                                            st.session_state.focused_scan[p_id] = None
                                            time.sleep(1)
                                            st.rerun()
                                        except Exception as e:
                                            st.error(f"Failed to launch scan process: {e}")
                                            
                # Render Inline Add Scan Configurator Form if open
                if add_scan_open:
                    st.write("")
                    with st.container(border=True):
                        st.markdown("### 🚀 Create Configured Scan Pill")
                        
                        # Aggregate verified channels across all linked devices
                        combined_verified_channels = []
                        for dev_phone, dev_info in devices.items():
                            combined_verified_channels.extend(dev_info.get("channels", []))
                        combined_verified_channels = sorted(list(set(combined_verified_channels)))
                        
                        scan_mode = st.radio(
                            "Choose Scan Configuration Method",
                            ["Select Predefined Scan", "Create Custom Scan"],
                            horizontal=True,
                            key=f"scan_mode_{p_id}"
                        )
                        
                        if scan_mode == "Select Predefined Scan":
                            selected_predef_key = st.selectbox(
                                "Available Opportunity Scans",
                                options=list(PREDEFINED_SCANS.keys()),
                                format_func=lambda x: PREDEFINED_SCANS[x]["name"],
                                key=f"predef_select_{p_id}",
                                help="Choose a preconfigured scan targeting popular academic or job channels."
                            )
                            selected_scan_info = PREDEFINED_SCANS[selected_predef_key]
                            
                            with st.container(border=True):
                                st.markdown(f"**Description:** {selected_scan_info['description']}")
                                st.markdown(f"**Pipeline Category:** `{selected_scan_info['category']}`")
                                st.markdown(f"**Channels to Monitor:** `{selected_scan_info['channels']}`")
                            
                            inline_category = selected_scan_info["category"]
                            inline_template = selected_scan_info["template"]
                            inline_scan_name = selected_predef_key
                            inline_channels = selected_scan_info["channels"]
                            
                        else:
                            inline_category = st.selectbox(
                                "Select Opportunity Pipeline",
                                ["Scholarships Discovery", "Job Search & Match"],
                                key=f"inline_cat_{p_id}",
                                help="Select the classification type of opportunities you want to search and evaluate."
                            )
                            inline_template = "scholarships" if inline_category == "Scholarships Discovery" else "jobs"
                            
                            inline_scan_name = st.text_input(
                                "Name this Scan",
                                placeholder="e.g. scholarship_europe, jobs_germany",
                                key=f"inline_name_{p_id}",
                                help="A unique name to identify this scan instance."
                            ).strip().replace(" ", "_")
                            
                            channel_input_mode = "Verified Selection"
                            if combined_verified_channels:
                                channel_input_mode = st.radio(
                                    "Channels Input Mode",
                                    ["Verified Selection", "Monitor Custom Channels"],
                                    horizontal=True,
                                    key=f"channel_mode_{p_id}"
                                )
                            else:
                                channel_input_mode = "Monitor Custom Channels"
                                st.info("No paired devices found. Enter custom channels manually below.")
                                
                            if channel_input_mode == "Verified Selection":
                                selected_channels = st.multiselect(
                                    "Select Subscribed WhatsApp Channels to Monitor",
                                    options=combined_verified_channels,
                                    key=f"inline_multiselect_{p_id}",
                                    help="Select one or more verified channels retrieved from your scanned devices."
                                )
                                inline_channels = ", ".join(selected_channels)
                            else:
                                inline_channels = st.text_area(
                                    "WhatsApp Channels to Monitor (Comma separated)",
                                    placeholder="e.g. Scholarship Alerts, 923009876543@newsletter",
                                    key=f"inline_channels_{p_id}",
                                    help="Specify names or IDs of subscribed WhatsApp Channels manually."
                                )
                                
                        btn_cols = st.columns([5, 1, 1])
                        with btn_cols[1]:
                            if st.button("Cancel", key=f"cancel_launch_{p_id}", use_container_width=True):
                                st.session_state.show_add_scan[p_id] = False
                                st.rerun()
                        with btn_cols[2]:
                            if st.button("Create", key=f"create_inline_{p_id}", type="primary", use_container_width=True):
                                if not inline_scan_name:
                                    st.error("Please enter a name for this scan.")
                                else:
                                    created_scans = load_created_scans()
                                    if p_id not in created_scans:
                                        created_scans[p_id] = {}
                                    
                                    created_scans[p_id][inline_scan_name] = {
                                        "name": inline_scan_name,
                                        "category": inline_category,
                                        "template": inline_template,
                                        "channels": inline_channels
                                    }
                                    save_created_scans(created_scans)
                                    st.success(f"Scan pill '{inline_scan_name}' added to pool successfully.")
                                    st.session_state.show_add_scan[p_id] = False
                                    time.sleep(1)
                                    st.rerun()

else:
    # Create / Edit Form View
    is_new = (editing_profile == "new")
    
    if is_new:
        st.subheader("➕ Create New Applicant Profile")
        default_name = ""
        default_gemini = ""
        default_jina = ""
        default_app_name = ""
        default_app_nationality = ""
        default_app_degree = ""
        default_app_fields = ""
        default_app_focus = ""
    else:
        p_info = profiles[editing_profile]
        st.subheader(f"✏️ Edit Profile: {p_info['name']}")
        default_name = p_info["name"]
        default_gemini = p_info["gemini_key"]
        default_jina = p_info.get("jina_key", "")
        default_app_name = p_info["applicant_name"]
        default_app_nationality = p_info["applicant_nationality"]
        default_app_degree = p_info["applicant_degree_tier"]
        default_app_fields = p_info["applicant_target_fields"]
        default_app_focus = p_info.get("applicant_focus", p_info.get("applicant_research_focus", ""))
        
    with st.container(border=True):
        if is_new:
            profile_display_name = st.text_input("Profile / Customer Display Name", placeholder="e.g. John Doe").strip()
        
        form_col1, form_col2 = st.columns([1, 1])
        
        with form_col1:
            st.markdown("### 🔑 API Authentication")
            gemini_key = st.text_input(
                "Google Gemini API Key",
                value=default_gemini,
                type="password"
            )
            jina_key = st.text_input(
                "Jina Reader API Key (Optional)",
                value=default_jina,
                type="password"
            )
            
        with form_col2:
            st.markdown("### 🧑‍💼 Applicant Evaluation Parameters")
            app_name = st.text_input("Full Name", value=default_app_name)
            app_nationality = st.text_input("Nationality", value=default_app_nationality)
            app_degree = st.text_input("Degree Tier & Grades", value=default_app_degree)
            app_fields = st.text_area("Target Fields of Study", value=default_app_fields)
            app_focus = st.text_area("Research Focus / Key Interests", value=default_app_focus)
            
        st.write("---")
        act_cols = st.columns([6, 1, 1])
        with act_cols[1]:
            if st.button("Cancel", use_container_width=True):
                del st.session_state.editing_profile
                st.rerun()
        with act_cols[2]:
            if st.button("Save", type="primary", use_container_width=True):
                if is_new:
                    if not profile_display_name:
                        st.error("Please enter a Profile name.")
                    else:
                        p_id = profile_display_name.lower().strip().replace(" ", "_")
                        p_id = "".join(c for c in p_id if c.isalnum() or c == "_")
                        
                        if p_id in profiles:
                            st.error("A profile with this name already exists.")
                        else:
                            profiles[p_id] = {
                                "id": p_id,
                                "name": profile_display_name,
                                "gemini_key": gemini_key,
                                "jina_key": jina_key,
                                "applicant_name": app_name,
                                "applicant_nationality": app_nationality,
                                "applicant_degree_tier": app_degree,
                                "applicant_target_fields": app_fields,
                                "applicant_focus": app_focus
                            }
                            save_profiles(profiles)
                            st.toast(f"Profile '{profile_display_name}' created.")
                            del st.session_state.editing_profile
                            time.sleep(1)
                            st.rerun()
                else:
                    profiles[editing_profile] = {
                        "id": editing_profile,
                        "name": default_name,
                        "gemini_key": gemini_key,
                        "jina_key": jina_key,
                        "applicant_name": app_name,
                        "applicant_nationality": app_nationality,
                        "applicant_degree_tier": app_degree,
                        "applicant_target_fields": app_fields,
                        "applicant_focus": app_focus
                    }
                    save_profiles(profiles)
                    st.toast("Profile changes saved.")
                    del st.session_state.editing_profile
                    time.sleep(1)
                    st.rerun()
