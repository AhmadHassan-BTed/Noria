import streamlit as st
import time
from ui.state import save_profiles

def render_profile_form_view(editing_profile, profiles):
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
        profile_display_name = st.text_input(
            "Profile / Customer Display Name",
            value=default_name,
            placeholder="e.g. John Doe"
        ).strip()
        
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
            
            st.markdown("### 🔔 Notification Settings")
            # Parse country code and number from target_phone
            default_cc = "+92"
            default_phone_num = ""
            default_custom_cc = "+"
            if not is_new:
                target_phone_val = p_info.get("target_phone", "")
                if target_phone_val:
                    target_phone_val = target_phone_val.replace(" ", "").replace("-", "")
                    # Match standard codes
                    for cc in ["+92", "+1", "+44", "+91", "+971", "+966", "+49", "+61"]:
                        if target_phone_val.startswith(cc):
                            default_cc = cc
                            default_phone_num = target_phone_val[len(cc):]
                            break
                        elif target_phone_val.startswith(cc[1:]):
                            default_cc = cc
                            default_phone_num = target_phone_val[len(cc)-1:]
                            break
                    else:
                        if target_phone_val.startswith("+"):
                            import re
                            m = re.match(r"^(\+\d{1,4})(.*)$", target_phone_val)
                            if m:
                                default_cc = "Other"
                                default_custom_cc = m.group(1)
                                default_phone_num = m.group(2)
                            else:
                                default_cc = "Other"
                                default_custom_cc = "+"
                                default_phone_num = target_phone_val
                        else:
                            if target_phone_val.startswith("92") and len(target_phone_val) > 10:
                                default_cc = "+92"
                                default_phone_num = target_phone_val[2:]
                            else:
                                default_cc = "+92"
                                default_phone_num = target_phone_val
            
            cc_options = ["+92", "+1", "+44", "+91", "+971", "+966", "+49", "+61", "Other"]
            cc_index = cc_options.index(default_cc) if default_cc in cc_options else 8
            
            cc_col, num_col = st.columns([1, 2])
            with cc_col:
                selected_cc = st.selectbox(
                    "Code",
                    options=cc_options,
                    index=cc_index,
                    key=f"profile_cc_{editing_profile}"
                )
                if selected_cc == "Other":
                    custom_cc = st.text_input("Code Value", value=default_custom_cc, key=f"profile_custom_cc_{editing_profile}")
                    country_code = custom_cc.strip()
                else:
                    country_code = selected_cc
            with num_col:
                phone_input = st.text_input(
                    "Target Phone",
                    value=default_phone_num,
                    placeholder="e.g. 3225522383",
                    key=f"profile_phone_{editing_profile}",
                    help="Phone number to receive matching opportunity notifications via WhatsApp."
                ).strip()
            
            target_phone = f"{country_code}{phone_input}".replace(" ", "").replace("-", "")
            
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
                if "editing_profile" in st.session_state:
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
                                "applicant_focus": app_focus,
                                "target_phone": target_phone,
                                "devices": {}
                            }
                            save_profiles(profiles)
                            st.toast(f"Profile '{profile_display_name}' created.")
                            if "editing_profile" in st.session_state:
                                del st.session_state.editing_profile
                            time.sleep(1)
                            st.rerun()
                else:
                    if not profile_display_name:
                        st.error("Please enter a Profile name.")
                    else:
                        existing_devices = profiles[editing_profile].get("devices", {})
                        profiles[editing_profile] = {
                            "id": editing_profile,
                            "name": profile_display_name,
                            "gemini_key": gemini_key,
                            "jina_key": jina_key,
                            "applicant_name": app_name,
                            "applicant_nationality": app_nationality,
                            "applicant_degree_tier": app_degree,
                            "applicant_target_fields": app_fields,
                            "applicant_focus": app_focus,
                            "target_phone": target_phone,
                            "devices": existing_devices
                        }
                        save_profiles(profiles)
                        st.toast("Profile changes saved.")
                        if "editing_profile" in st.session_state:
                            del st.session_state.editing_profile
                        time.sleep(1)
                        st.rerun()
