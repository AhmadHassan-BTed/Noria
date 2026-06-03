import streamlit as st
import os
import subprocess
import signal
import time
from ui.state import PREDEFINED_SCANS, get_session_status, save_running_processes

def render_scans_view(running_instances, profiles):
    st.title("📡 Active Scanning Operations")
    st.write("Monitor live opportunity extraction pipelines, review discovery diagnostics, and terminate active scans.")
    st.write("---")
    
    # 1. Master List of Active Scans
    st.subheader("📡 Active Opportunity Scans")
    
    # Filter out linkers to only show scanning operations in the scans view
    scanning_instances = {name: info for name, info in running_instances.items() if info.get("category") != "Linker"}
    
    if not scanning_instances:
        st.info("No active opportunity scans are running in the system. Use the launchpad below to start one.")
    else:
        # Display as a neat list of container cards
        for scan_name, info in sorted(scanning_instances.items()):
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
                        disc_status = status_info.get("discoveryStatus", "COMPLETED")
                        if disc_status == "DISCOVERING":
                            disc_progress = status_info.get("discoveryProgress", 0)
                            disc_msg = status_info.get("discoveryMessage", "Discovering channels...")
                            st.warning(f"🔍 Discovery: {disc_progress}%")
                            st.progress(disc_progress / 100.0)
                            st.caption(f"_{disc_msg}_")
                        else:
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
                            if scan_name in running_instances:
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
                        daemon_log = open(f"data/daemon-{actual_scan_name}.log", "a", encoding="utf-8")
                        p = subprocess.Popen(
                            cmd,
                            stdout=daemon_log,
                            stderr=subprocess.STDOUT,
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
