import streamlit as st
import time
import os
import subprocess
import json
from ui.state import (
    load_created_scans,
    save_created_scans,
    save_profiles,
    save_running_processes,
    get_session_status,
    PREDEFINED_SCANS
)
from ui.components.device_card import render_device_linker_fragment, render_linked_devices_fragment

def render_profiles_view(profiles, running_instances):
    st.title("👤 Applicant Profiles Directory")
    st.write("Manage applicant profiles, configure Gemini API keys, pair WhatsApp channels, and orchestrate opportunity evaluation scans.")
    st.write("---")

    # Directory View Header
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
            with st.expander(f"👤 {p_info['name']}", expanded=True):
                card_header_cols = st.columns([5, 1.5, 1.5, 1.5])
                with card_header_cols[0]:
                    st.markdown("### ⚙️ Operations Control Panel")
                with card_header_cols[1]:
                    if st.button("🧹 Clear Cache", key=f"clear_cache_profile_{p_id}", use_container_width=True):
                        profile_scans = [
                            name for name, info in running_instances.items()
                            if info.get("profileId") == p_id
                        ]
                        for scan_name in profile_scans:
                            flag_path = f"data/clear-cache-{scan_name}.flag"
                            try:
                                with open(flag_path, "w") as f:
                                    f.write("clear")
                            except Exception:
                                pass
                        st.toast(f"Cache clear requested for {len(profile_scans)} active scan(s).")
                with card_header_cols[2]:
                    if st.button("✏️ Edit", key=f"edit_btn_{p_id}", use_container_width=True):
                        st.session_state.editing_profile = p_id
                        st.rerun()
                with card_header_cols[3]:
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
                        render_device_linker_fragment(p_id, p_info, profiles, running_instances)
                    else:
                        devices = p_info.get("devices", {})
                        if not devices:
                            st.info("No active devices linked to this profile.")
                        else:
                            st.success(f"Registered Devices: **{len(devices)}** linked.")
                            for d_phone in sorted(devices.keys()):
                                device_sess_id = f"session_{p_id}_dev_{d_phone}"
                                status_info = get_session_status(device_sess_id)
                                curr_status = status_info.get("status", "UNKNOWN")
                                reason = status_info.get("reason", "")
                                if curr_status in ["SCAN_QR", "auth_failure"]:
                                    st.markdown(f"⚠️ **Device Disconnected (Re-link required):** `+{d_phone}`")
                                elif curr_status == "DISCONNECTED" and not ("Stopped" in reason or "user" in reason.lower()):
                                    st.markdown(f"⚠️ **Device Offline:** `+{d_phone}`")
                                else:
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
                                "APPLICANT_RESEARCH_FOCUS": p_info.get("applicant_focus", "")
                            })
                            
                            try:
                                daemon_log = open(f"data/daemon-{linker_sess_id}.log", "a", encoding="utf-8")
                                p = subprocess.Popen(
                                    cmd,
                                    stdout=daemon_log,
                                    stderr=subprocess.STDOUT,
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
                                st.session_state.linker_progress = 5
                                st.rerun()
                            except Exception as e:
                                st.error(f"Failed to spawn linker socket: {e}")
                
                st.write("---")

                # Render Linked Devices details (including sub-cards and toggle buttons)
                render_linked_devices_fragment(p_id, p_info, profiles, running_instances)
                st.write("---")
                
                # Fetch persistent unassigned scans
                created_scans = load_created_scans()
                user_configured_scans = created_scans.get(p_id, {})
                
                st.markdown("### 🆕 Configured Scans Pool (Pills)")
                
                active_focus = st.session_state.focused_scan.get(p_id, None)
                add_scan_open = st.session_state.show_add_scan.get(p_id, False)
                devices = p_info.get("devices", {})
                
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
                            source_mode_disp = scan_cfg.get("sourceMode", "individual,groups,channels")
                            target_phone_disp = p_info.get("target_phone") or "Default (Self/Scanning Device)"
                            st.markdown(f"""
                            * **Pipeline Category:** {scan_cfg['category']}
                            * **Pipeline Template:** `{scan_cfg['template']}`
                            * **Message Sources:** `{source_mode_disp}`
                            * **Notification Target:** `{target_phone_disp}`
                            """)
                            if "individual" in source_mode_disp:
                                st.markdown(f"* **Chats Whitelist:** `{scan_cfg.get('chats') or 'All direct chats'}`")
                            if "groups" in source_mode_disp:
                                st.markdown(f"* **Groups Whitelist:** `{scan_cfg.get('groups') or 'All groups'}`")
                            if "channels" in source_mode_disp:
                                st.markdown(f"* **Channels Whitelist:** `{scan_cfg.get('channels') or 'All channels'}`")
                            
                            # Check if scan is active on any device
                            matching_instances = [name for name, info in running_instances.items() if info.get("profileId") == p_id and info.get("template") == scan_cfg["template"] and (name == active_focus or name.startswith(active_focus + "_"))]
                            
                            if matching_instances:
                                running_phones = [
                                    running_instances[n].get('devicePhone') or running_instances[n].get('phone') or 'Unknown'
                                    for n in matching_instances
                                ]
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
                            if not p_info.get("gemini_key"):
                                st.error("⚠️ **Gemini API Key is missing!** You must configure a Gemini API key for this profile before you can activate a scan. Please click **Edit** at the top of the card to configure your API keys.")
                            elif not devices:
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
                                        
                                        # Pass sourceMode, channels, groups, and chats if present
                                        src_mode = scan_cfg.get("sourceMode")
                                        if src_mode:
                                            cmd.extend(["--sourceMode", src_mode])
                                        if scan_cfg.get("channels"):
                                            cmd.extend(["--channels", scan_cfg["channels"]])
                                        if scan_cfg.get("groups"):
                                            cmd.extend(["--groups", scan_cfg["groups"]])
                                        if scan_cfg.get("chats"):
                                            cmd.extend(["--chats", scan_cfg["chats"]])
                                            
                                        notification_target = p_info.get("target_phone") or selected_device_phone
                                        cmd.extend(["--phone", notification_target])

                                        custom_env = os.environ.copy()
                                        custom_env.update({
                                            "GEMINI_API_KEY": p_info["gemini_key"],
                                            "JINA_API_KEY": p_info.get("jina_key", ""),
                                            "APPLICANT_NAME": p_info["applicant_name"],
                                            "APPLICANT_NATIONALITY": p_info["applicant_nationality"],
                                            "APPLICANT_DEGREE_TIER": p_info["applicant_degree_tier"],
                                            "APPLICANT_TARGET_FIELDS": p_info["applicant_target_fields"],
                                            "APPLICANT_RESEARCH_FOCUS": p_info.get("applicant_focus", "")
                                        })
                                        # Reset the status file to prevent rendering stale previous statuses
                                        status_path = f"data/status-{device_sess_id}.json"
                                        try:
                                            with open(status_path, "w") as f:
                                                json.dump({
                                                    "status": "CONNECTING",
                                                    "reason": "Starting background daemon..."
                                                 }, f)
                                        except Exception:
                                            pass

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
                                                "template": scan_cfg["template"],
                                                "category": scan_cfg["category"],
                                                "sessionId": device_sess_id,
                                                "profileId": p_id,
                                                "profileName": p_info["name"],
                                                "channels": scan_cfg.get("channels", ""),
                                                "groups": scan_cfg.get("groups", ""),
                                                "chats": scan_cfg.get("chats", ""),
                                                "sourceMode": scan_cfg.get("sourceMode", "individual,groups,channels"),
                                                "phone": notification_target,
                                                "devicePhone": selected_device_phone,
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
                        
                        # Aggregate verified channels, groups, and chats across all linked devices
                        combined_verified_channels = []
                        combined_verified_groups = []
                        combined_verified_chats = []
                        for dev_phone, dev_info in devices.items():
                            combined_verified_channels.extend(dev_info.get("channels", []))
                            combined_verified_groups.extend(dev_info.get("groups", []))
                            combined_verified_chats.extend(dev_info.get("chats", []))
                        combined_verified_channels = sorted(list(set(combined_verified_channels)))
                        combined_verified_groups = sorted(list(set(combined_verified_groups)))
                        combined_verified_chats = sorted(list(set(combined_verified_chats)))
                        
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
                            inline_groups = ""
                            inline_chats = ""
                            chat_mode = "Disabled"
                            group_mode = "Disabled"
                            channel_mode = "Selected Only"
                            
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
                            
                            st.markdown("##### ⚙️ Configure Message Sources")
                            src_col1, src_col2, src_col3 = st.columns(3)
                            with src_col1:
                                chat_mode = st.selectbox(
                                    "💬 Individual Chats",
                                    ["All", "Selected Only", "Disabled"],
                                    index=0,
                                    key=f"chat_mode_{p_id}",
                                    help="Configure direct messages to scan."
                                )
                            with src_col2:
                                group_mode = st.selectbox(
                                    "👥 Groups",
                                    ["All", "Selected Only", "Disabled"],
                                    index=0,
                                    key=f"group_mode_{p_id}",
                                    help="Configure group chats to scan."
                                )
                            with src_col3:
                                channel_mode = st.selectbox(
                                    "📡 Channels",
                                    ["All", "Selected Only", "Disabled"],
                                    index=0,
                                    key=f"channel_mode_{p_id}",
                                    help="Configure channel posts to scan."
                                )

                            # Whitelist fields
                            inline_chats = ""
                            inline_groups = ""
                            inline_channels = ""

                            if chat_mode == "Selected Only":
                                if combined_verified_chats:
                                    selected_chats = st.multiselect(
                                        "Select Chats to Monitor",
                                        options=combined_verified_chats,
                                        key=f"inline_chats_sel_{p_id}",
                                        help="Select direct chats known to your devices."
                                    )
                                    inline_chats = ", ".join(selected_chats)
                                else:
                                    inline_chats = st.text_area(
                                        "Specify Chats to Monitor (Comma separated)",
                                        placeholder="e.g. 923217744858, John Doe",
                                        key=f"inline_chats_text_{p_id}",
                                        help="Specify names or phone numbers manually."
                                    )

                            if group_mode == "Selected Only":
                                if combined_verified_groups:
                                    selected_groups = st.multiselect(
                                        "Select Groups to Monitor",
                                        options=combined_verified_groups,
                                        key=f"inline_groups_sel_{p_id}",
                                        help="Select groups known to your devices."
                                    )
                                    inline_groups = ", ".join(selected_groups)
                                else:
                                    inline_groups = st.text_area(
                                        "Specify Groups to Monitor (Comma separated)",
                                        placeholder="e.g. Scholarship Group, 120363023456789@g.us",
                                        key=f"inline_groups_text_{p_id}",
                                        help="Specify names or group IDs manually."
                                    )

                            if channel_mode == "Selected Only":
                                if combined_verified_channels:
                                    selected_channels = st.multiselect(
                                        "Select Channels to Monitor",
                                        options=combined_verified_channels,
                                        key=f"inline_channels_sel_{p_id}",
                                        help="Select channels known to your devices."
                                    )
                                    inline_channels = ", ".join(selected_channels)
                                else:
                                    inline_channels = st.text_area(
                                        "WhatsApp Channels to Monitor (Comma separated)",
                                        placeholder="e.g. Scholarship Alerts, 120363023456789@newsletter",
                                        key=f"inline_channels_text_{p_id}",
                                        help="Specify channel names or IDs manually."
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
                                    
                                    if scan_mode == "Select Predefined Scan":
                                        source_mode_str = "channels"
                                        final_chats = ""
                                        final_groups = ""
                                        final_channels = inline_channels
                                    else:
                                        src_mode_list = []
                                        if chat_mode != "Disabled":
                                            src_mode_list.append("individual")
                                        if group_mode != "Disabled":
                                            src_mode_list.append("groups")
                                        if channel_mode != "Disabled":
                                            src_mode_list.append("channels")
                                        source_mode_str = ",".join(src_mode_list) if src_mode_list else "individual,groups,channels"
                                        
                                        final_chats = inline_chats if chat_mode == "Selected Only" else ""
                                        final_groups = inline_groups if group_mode == "Selected Only" else ""
                                        final_channels = inline_channels if channel_mode == "Selected Only" else ""

                                    created_scans[p_id][inline_scan_name] = {
                                        "name": inline_scan_name,
                                        "category": inline_category,
                                        "template": inline_template,
                                        "sourceMode": source_mode_str,
                                        "channels": final_channels,
                                        "groups": final_groups,
                                        "chats": final_chats
                                    }
                                    save_created_scans(created_scans)
                                    st.success(f"Scan pill '{inline_scan_name}' added to pool successfully.")
                                    st.session_state.show_add_scan[p_id] = False
                                    time.sleep(1)
                                    st.rerun()
