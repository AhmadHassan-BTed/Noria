import streamlit as st
import os
import time
import signal
import subprocess
import io
import urllib.parse
import streamlit.components.v1 as components

try:
    import qrcode
    HAS_QRCODE = True
except ImportError:
    HAS_QRCODE = False

from ui.state import (
    get_session_status,
    read_session_logs,
    clear_session_logs,
    save_profiles,
    save_running_processes
)

@st.fragment(run_every=2)
def render_device_linker_fragment(p_id, p_info, profiles, running_instances):
    linker_sess_id = st.session_state.linker_sess_id
    if not linker_sess_id:
        return
        
    status_info = get_session_status(linker_sess_id)
    status = status_info.get("status", "UNKNOWN")
    
    # Track when linking started for timeout detection
    if "linker_start_time" not in st.session_state:
        st.session_state.linker_start_time = time.time()
    
    elapsed = time.time() - st.session_state.get("linker_start_time", time.time())
    
    st.markdown(f"**Connection Linker Status:** `{status}`")
    
    # ── Handle CONNECTED status ────────────────────────────────────────────
    if status == "CONNECTED":
        linked_phone = status_info.get("phone", "")
        linked_channels = status_info.get("channels", [])
        linked_wid = status_info.get("wid", "")
        
        # Fallback: if phone is empty but we have WID or session info, use that
        if not linked_phone and linked_wid:
            linked_phone = linked_wid.split('@')[0] if '@' in linked_wid else linked_wid
        
        # Final fallback: generate a device identifier from timestamp
        if not linked_phone:
            linked_phone = f"device_{int(time.time())}"
        
        # Ensure devices dict exists
        if "devices" not in p_info:
            p_info["devices"] = {}
        
        p_info["devices"][linked_phone] = {
            "phone": linked_phone,
            "channels": linked_channels,
            "linkedAt": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        save_profiles(profiles)
        
        # Stop any existing scans on this device to release file locks on dst_dir
        for name, info in list(running_instances.items()):
            is_matching_device = (
                info.get("phone") == linked_phone or
                info.get("devicePhone") == linked_phone or
                info.get("sessionId") == f"session_{p_id}_dev_{linked_phone}"
            )
            if info.get("profileId") == p_id and is_matching_device and name != linker_sess_id:
                try:
                    if os.name == 'nt':
                        subprocess.run(['taskkill', '/F', '/T', '/PID', str(info['pid'])], capture_output=True)
                    else:
                        os.kill(info['pid'], signal.SIGTERM)
                    del running_instances[name]
                except Exception:
                    pass
        
        if linker_sess_id in running_instances:
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
            
        # Clean up any previous error status file for this specific device
        try:
            os.remove(f"data/status-session_{p_id}_dev_{linked_phone}.json")
        except FileNotFoundError:
            pass
        
        st.session_state.linking_profile = None
        st.session_state.linker_sess_id = None
        st.session_state.pop("linker_start_time", None)
        st.success(f"Device +{linked_phone} linked successfully with {len(linked_channels)} subscribed channel(s)!")
        time.sleep(1)
        st.rerun()
            
    # ── Handle SCAN_QR status ──────────────────────────────────────────────
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
                    if hasattr(qr_img, 'get_image'):
                        pil_img = qr_img.get_image()
                        pil_img.save(buf, format='PNG')
                    elif hasattr(qr_img, 'save'):
                        try:
                            qr_img.save(buf, format='PNG')
                        except TypeError:
                            qr_img.save(buf)
                    else:
                        buf.write(bytes(qr_img))
                    
                    st.image(buf.getvalue(), caption="Scan QR Code to Pair Device", width=220)
                else:
                    st.code(qr_data, language="text")
            except Exception as e:
                st.error(f"Failed to render QR: {e}")
        else:
            st.info("Loading QR Code from server...")
            
    # ── Handle DISCONNECTED status ─────────────────────────────────────────
    elif status == "DISCONNECTED":
        grace_period = 30  # seconds before showing actual error
        
        if elapsed < grace_period:
            curr_progress = st.session_state.get("linker_progress", 5)
            if curr_progress < 85:
                curr_progress += 3
                st.session_state.linker_progress = curr_progress

            if curr_progress <= 30:
                step_msg = "🚀 Launching Chrome headless engine..."
            elif curr_progress <= 50:
                step_msg = "🔌 Initializing WhatsApp connection..."
            elif curr_progress <= 70:
                step_msg = "🔑 Synchronizing authentication keys..."
            else:
                step_msg = "📱 Preparing QR code..."

            st.info(step_msg)
            st.progress(curr_progress / 100.0)
            st.caption(f"Elapsed: {int(elapsed)}s — Connecting to WhatsApp...")
            return
        
        disconnect_reason = status_info.get("reason", "Connection was terminated")
        
        if linker_sess_id in running_instances:
            del running_instances[linker_sess_id]
            save_running_processes(running_instances)
        
        st.error(f"❌ Connection failed: {disconnect_reason}")
        
        log_lines = read_session_logs(linker_sess_id, max_lines=20)
        if log_lines:
            with st.expander("📋 View Error Logs", expanded=False):
                st.code("\n".join(log_lines[-10:]), language="text")
        
        if st.button("Try Again", key=f"retry_link_{p_id}", type="primary", use_container_width=True):
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
            st.session_state.pop("linker_start_time", None)
            st.rerun()
            
    # ── Handle initializing/unknown status (progress animation) ────────────
    else:
        timeout_seconds = 90
        
        if elapsed > timeout_seconds:
            st.error(f"⏱️ Connection timed out after {int(elapsed)} seconds.")
            
            if linker_sess_id in running_instances:
                del running_instances[linker_sess_id]
                save_running_processes(running_instances)
            
            if st.button("Try Again", key=f"retry_timeout_{p_id}", type="primary", use_container_width=True):
                st.session_state.linking_profile = None
                st.session_state.linker_sess_id = None
                st.session_state.pop("linker_start_time", None)
                st.rerun()
            return
        
        curr_progress = st.session_state.get("linker_progress", 5)
        if curr_progress < 90:
            curr_progress += 5
            if curr_progress > 90:
                curr_progress = 90
            st.session_state.linker_progress = curr_progress

        if curr_progress <= 20:
            step_msg = "🚀 Launching Chrome headless engine..."
        elif curr_progress <= 40:
            step_msg = "🔌 Initializing WhatsApp connection..."
        elif curr_progress <= 60:
            step_msg = "🔑 Synchronizing authentication keys..."
        elif curr_progress <= 80:
            step_msg = "📱 Generating QR code for pairing..."
        else:
            step_msg = f"⏳ Waiting for WhatsApp response... ({int(elapsed)}s)"

        st.info(step_msg)
        st.progress(curr_progress / 100.0)
        st.caption(f"Elapsed: {int(elapsed)}s — Please wait while we connect to WhatsApp...")
        
        if elapsed > 30:
            st.caption("💡 Taking longer than expected? Make sure Chrome is installed and accessible.")
        
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

@st.fragment(run_every=2)
def render_linked_devices_fragment(p_id, p_info, profiles, running_instances):
    st.markdown("### 📱 Linked Devices (Sub-cards)")
    devices = p_info.get("devices", {})
    if not devices:
        st.info("No active devices linked to this profile. Pair a device upfront using the button above.")
    else:
        dev_cols = st.columns(min(len(devices), 3))
        for idx, (dev_phone, dev_info) in enumerate(sorted(devices.items())):
            col_idx = idx % min(len(devices), 3)
            with dev_cols[col_idx]:
                dev_expanded_key = f"dev_expanded_{p_id}_{dev_phone}"
                if dev_expanded_key not in st.session_state:
                    st.session_state[dev_expanded_key] = True
                
                is_dev_expanded = st.session_state[dev_expanded_key]
                arrow = "▼" if is_dev_expanded else "▶"
                if st.button(f"{arrow} 📱 +{dev_phone}", key=f"dev_hdr_btn_{p_id}_{dev_phone}", use_container_width=True):
                    st.session_state[dev_expanded_key] = not is_dev_expanded
                    st.rerun()
                
                if is_dev_expanded:
                    with st.container(border=True):
                        st.caption(f"Linked: {dev_info.get('linkedAt', 'Unknown')}")
                        
                        device_sess_id = f"session_{p_id}_dev_{dev_phone}"
                        status_info = get_session_status(device_sess_id)
                        curr_status = status_info.get("status", "UNKNOWN")
                        reason = status_info.get("reason", "")
                        
                        if curr_status in ["SCAN_QR", "auth_failure"]:
                            st.error("⚠️ Authentication Expired - Re-link required")
                        elif curr_status == "DISCONNECTED":
                            if "Stopped" in reason or "user" in reason.lower():
                                st.info("💤 Inactive (Standby)")
                            else:
                                st.warning("⚠️ Offline")
                            
                        # Scans running on this device
                        device_scans = [
                            name for name, info in running_instances.items()
                            if info.get("profileId") == p_id and (
                                info.get("devicePhone") == dev_phone or 
                                info.get("sessionId") == f"session_{p_id}_dev_{dev_phone}" or
                                (not info.get("devicePhone") and info.get("phone") == dev_phone)
                            )
                        ]
                        
                        channels_list = dev_info.get("channels", [])
                        groups_list = dev_info.get("groups", [])
                        chats_list = dev_info.get("chats", [])
                        profile_changed = False
                        
                        for scan_name in device_scans:
                            scan_info = running_instances[scan_name]
                            status_info = get_session_status(scan_info["sessionId"])
                            
                            discovered_channels = status_info.get("channels", [])
                            if len(discovered_channels) > len(channels_list):
                                channels_list = discovered_channels
                                dev_info["channels"] = discovered_channels
                                profile_changed = True
                                
                            discovered_groups = status_info.get("groups", [])
                            if len(discovered_groups) > len(groups_list):
                                groups_list = discovered_groups
                                dev_info["groups"] = discovered_groups
                                profile_changed = True
                                
                            discovered_chats = status_info.get("chats", [])
                            if len(discovered_chats) > len(chats_list):
                                chats_list = discovered_chats
                                dev_info["chats"] = discovered_chats
                                profile_changed = True
                                
                        if profile_changed:
                            save_profiles(profiles)
                        
                        # Calculate active scans and matches statistics
                        scans_count = len(device_scans)
                        matches_count = 0
                        for scan_name in device_scans:
                            log_path = f"data/daemon-{scan_name}.log"
                            if os.path.exists(log_path):
                                try:
                                    with open(log_path, "r", encoding="utf-8", errors="replace") as f:
                                        content = f.read()
                                        matches_count += content.count("Match found!")
                                except Exception:
                                    pass

                        st.markdown(f"""
                        <div style="background-color: var(--bg-level-3); border: 1px solid var(--border-level-3); border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; text-align: center;">
                            <span style="color: var(--text-color); font-family: \'Outfit\', sans-serif; font-weight: 600; font-size: 14px;">
                                📡 Running Scans: <span style="color: var(--whatsapp-green);">{scans_count}</span> &nbsp;|&nbsp; 🔍 Matches: <span style="color: var(--whatsapp-green);">{matches_count}</span>
                            </span>
                        </div>
                        """, unsafe_allow_html=True)
                        
                        st.markdown(f"**Subscribed Channels:** `{len(channels_list)}` | **Groups:** `{len(groups_list)}` | **Direct Chats:** `{len(chats_list)}`")
                        
                        if not device_scans:
                            st.info("No active scans on this device.")
                        else:
                            st.markdown("**Running Scans:**")
                            for scan_name in device_scans:
                                scan_info = running_instances[scan_name]
                                st.markdown(f"🔸 `{scan_name}` (`{scan_info['category']}`)")
                                
                                status_info = get_session_status(scan_info["sessionId"])
                                scan_status = status_info.get("status", "UNKNOWN")
                                disc_status = status_info.get("discoveryStatus", "COMPLETED")
                                
                                if scan_status == "CONNECTED" and disc_status == "DISCOVERING":
                                    disc_progress = status_info.get("discoveryProgress", 0)
                                    disc_msg = status_info.get("discoveryMessage", "Discovering channels...")
                                    st.warning(f"🔍 Discovery: {disc_progress}%")
                                    st.progress(disc_progress / 100.0)
                                    st.caption(f"_{disc_msg}_")
                                    
                                act_col1, act_col2 = st.columns([1, 1])
                                with act_col1:
                                    if scan_status == "CONNECTED":
                                        if disc_status == "DISCOVERING":
                                            st.info("Syncing")
                                        else:
                                            st.success("Active")
                                    elif scan_status == "DISCONNECTED":
                                        reason = status_info.get("reason", "Disconnected")
                                        st.error(f"Error: {reason}")
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
                                            
                                            status_path = f"data/status-{scan_info['sessionId']}.json"
                                            try:
                                                with open(status_path, "w") as f:
                                                    json.dump({
                                                        "status": "DISCONNECTED",
                                                        "reason": "Stopped by user"
                                                    }, f)
                                            except Exception:
                                                pass
                                                
                                            st.toast(f"Scan '{scan_name}' stopped successfully.")
                                            time.sleep(1)
                                            st.rerun()
                                        except Exception as e:
                                            st.error(f"Error: {e}")
                        
                        st.write("---")
                        
                        # ── Device Log Viewer ──────────────────────────────────
                        device_sess_id = f"session_{p_id}_dev_{dev_phone}"
                        show_logs = st.toggle(f"📋 Show Device Logs — +{dev_phone}", value=False, key=f"toggle_logs_{p_id}_{dev_phone}")
                        if show_logs:
                            with st.container(border=True):
                                log_col1, log_col2 = st.columns([3, 1])
                                with log_col1:
                                    st.caption(f"Session ID: `{device_sess_id}`")
                                with log_col2:
                                    if st.button("🗑️ Clear Logs", key=f"clear_logs_{p_id}_{dev_phone}", use_container_width=True):
                                        if clear_session_logs(device_sess_id):
                                            st.toast("Logs cleared successfully.")
                                        else:
                                            st.toast("No logs to clear.")
                                
                                log_lines = read_session_logs(device_sess_id, max_lines=100)
                                
                                if not log_lines:
                                    st.info("No logs available for this device. Logs will appear once the device is connected and processing messages.")
                                else:
                                    log_text = "\n".join(log_lines)
                                    encoded_logs = urllib.parse.quote(log_text)
                                    copy_btn_html = f"""
                                    <div style="display: flex; justify-content: flex-end; margin-bottom: -10px;">
                                        <button id="copyBtn" style="
                                            background-color: #2b2b36;
                                            color: #f4f4f4;
                                            border: 1px solid #444;
                                            padding: 6px 12px;
                                            border-radius: 6px;
                                            cursor: pointer;
                                            font-size: 13px;
                                            font-family: system-ui, -apple-system, sans-serif;
                                            display: flex;
                                            align-items: center;
                                            gap: 6px;
                                            transition: background-color 0.2s;
                                        " onclick="copyLogs()">
                                            📋 Copy Logs
                                        </button>
                                        <textarea id="logText" style="display:none;"></textarea>
                                    </div>
                                    <script>
                                    function copyLogs() {{
                                        const text = decodeURIComponent("{encoded_logs}");
                                        const textArea = document.getElementById("logText");
                                        textArea.style.display = "block";
                                        textArea.value = text;
                                        textArea.select();
                                        try {{
                                            document.execCommand("copy");
                                            const btn = document.getElementById("copyBtn");
                                            btn.innerHTML = "✅ Copied!";
                                            btn.style.backgroundColor = "#1b4d3e";
                                            setTimeout(() => {{
                                                btn.innerHTML = "📋 Copy Logs";
                                                btn.style.backgroundColor = "#2b2b36";
                                            }}, 2000);
                                        }} catch (err) {{
                                            alert("Could not copy: " + err);
                                        }}
                                        textArea.style.display = "none";
                                    }}
                                    </script>
                                    """
                                    components.html(copy_btn_html, height=45)
                                    st.code(log_text, language="text")
                                    st.caption(f"Showing last {len(log_lines)} log entries. Logs auto-refresh every 2 seconds.")
                        
                        st.write("---")
                        
                        col_cache, col_unlink = st.columns([1, 1])
                        with col_cache:
                            if st.button("🧹 Clear Cache", key=f"clear_cache_dev_{p_id}_{dev_phone}", use_container_width=True):
                                for scan_name in device_scans:
                                    flag_path = f"data/clear-cache-{scan_name}.flag"
                                    try:
                                        with open(flag_path, "w") as f:
                                            f.write("clear")
                                    except Exception:
                                        pass
                                st.toast(f"Cache clear requested for active scan(s) on +{dev_phone}.")
                        with col_unlink:
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
                                    shutil.rmtree(f".wwebjs_auth/session-session_{p_id}_dev_{dev_phone}", ignore_errors=True)
                                except Exception:
                                    pass
                                
                                try:
                                    os.remove(f"data/status-{device_sess_id}.json")
                                except FileNotFoundError:
                                    pass
                                clear_session_logs(device_sess_id)
                                    
                                del p_info["devices"][dev_phone]
                                save_profiles(profiles)
                                st.toast("Device unlinked successfully.")
                                time.sleep(1)
                                st.rerun()
