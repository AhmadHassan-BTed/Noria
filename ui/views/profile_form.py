import streamlit as st
import time
import json
from ui.state import save_profiles
from ui.components.countries import COUNTRIES

def render_profile_form_view(editing_profile, profiles):
    is_new = (editing_profile == "new")
    
    if "editing_llms" not in st.session_state or st.session_state.get("llms_profile_id") != editing_profile:
        st.session_state.llms_profile_id = editing_profile
        if is_new:
            st.session_state.editing_llms = [
                {"provider": "Gemini", "api_key": "", "model": "Auto"}
            ]
        else:
            p_info = profiles[editing_profile]
            if "llm_chain" in p_info and p_info["llm_chain"]:
                st.session_state.editing_llms = [dict(item) for item in p_info["llm_chain"]]
            else:
                st.session_state.editing_llms = [
                    {
                        "provider": p_info.get("llm_provider", "Gemini"),
                        "api_key": p_info.get("llm_api_key", p_info.get("gemini_key", "")),
                        "model": p_info.get("llm_model", "Auto")
                    }
                ]

    if is_new:
        st.markdown("## ➕ Create New Applicant Profile")
        default_name = ""
        default_jina = ""
        default_app_name = ""
        default_app_nationality = ""
        default_app_degree = ""
        default_app_fields = ""
        default_app_focus = ""
    else:
        p_info = profiles[editing_profile]
        st.markdown(f"## ✏️ Edit Profile: {p_info['name']}")
        default_name = p_info["name"]
        default_jina = p_info.get("jina_key", "")
        default_app_name = p_info["applicant_name"]
        default_app_nationality = p_info["applicant_nationality"]
        default_app_degree = p_info["applicant_degree_tier"]
        default_app_fields = p_info["applicant_target_fields"]
        default_app_focus = p_info.get("applicant_focus", p_info.get("applicant_research_focus", ""))
        
    with st.container(border=True):
        profile_display_name = st.text_input(
            "Profile Display Name",
            value=default_name,
            placeholder="e.g. John Doe",
            help="A custom name or label for this applicant profile (e.g., John Doe - Frontend dev)."
        ).strip()
        
        form_col1, form_col2 = st.columns([1, 1])
        
        with form_col1:
            st.markdown("##### 🔑 LLM Provider Chain (Fallbacks)")
            st.markdown(
                "<div style='font-size: 14.5px; margin-bottom: 8px; color: #8E9297 !important;'>"
                "ℹ️ Need API Keys? "
                "<a href='https://aistudio.google.com/' target='_blank' style='color: #25D366 !important; font-weight: 600;'>Get Gemini Key</a> | "
                "<a href='https://console.groq.com/' target='_blank' style='color: #25D366 !important; font-weight: 600;'>Get Groq Key</a>"
                "</div>",
                unsafe_allow_html=True
            )
            st.caption("Configure one or more LLM providers. If a provider fails (e.g. rate limits or quota), the system automatically attempts the next fallback in the list.")

            new_llms = []
            for idx, llm_cfg in enumerate(st.session_state.editing_llms):
                with st.container(border=True):
                    col_prov, col_key, col_model, col_del = st.columns([1.2, 2.5, 1.5, 0.5])
                    with col_prov:
                        prov = st.selectbox(
                            "Provider",
                            options=["Gemini", "Groq"],
                            index=0 if llm_cfg["provider"] == "Gemini" else 1,
                            key=f"llm_prov_{idx}"
                        )
                    with col_key:
                        if prov == "Gemini":
                            llm_help = (
                                "**Step-by-Step Guide to get a Gemini API Key:**\n\n"
                                "1. Click the link above or go to [Google AI Studio](https://aistudio.google.com/).\n"
                                "2. Log in with your Google account.\n"
                                "3. Click the **Get API key** button in the top left.\n"
                                "4. Click **Create API key** (select or create a project).\n"
                                "5. Copy your generated key and paste it here."
                            )
                        else:
                            llm_help = (
                                "**Step-by-Step Guide to get a Groq API Key:**\n\n"
                                "1. Click the link above or go to the [Groq Console](https://console.groq.com/).\n"
                                "2. Log in or create a free Groq account.\n"
                                "3. Click on **API Keys** in the left sidebar.\n"
                                "4. Click the **Create API Key** button.\n"
                                "5. Copy your new API key and paste it here."
                            )
                        key_val = st.text_input(
                            "API Key",
                            value=llm_cfg["api_key"],
                            type="password",
                            key=f"llm_key_{idx}",
                            help=llm_help
                        )
                    with col_model:
                        if prov == "Gemini":
                            models = ["Auto", "gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-pro"]
                        else:
                            models = [
                                "Auto",
                                "llama-3.3-70b-versatile",
                                "llama3-70b-8192",
                                "mixtral-8x7b-32768",
                                "llama-3.1-8b-instant",
                                "gemma2-9b-it"
                            ]
                        
                        default_model = llm_cfg["model"]
                        if default_model not in models:
                            models.append(default_model)
                        def_idx = models.index(default_model)
                        model_selected = st.selectbox(
                            "Model",
                            options=models,
                            index=def_idx,
                            key=f"llm_model_{idx}"
                        )
                    with col_del:
                        st.markdown("<div style='height: 28px;'></div>", unsafe_allow_html=True)
                        if st.button("🗑️", key=f"llm_del_{idx}", help="Remove this LLM from chain", use_container_width=True):
                            st.session_state.editing_llms.pop(idx)
                            st.rerun()
                    
                    new_llms.append({
                        "provider": prov,
                        "api_key": key_val,
                        "model": model_selected
                    })

            st.session_state.editing_llms = new_llms

            col_add_space, col_add_btn = st.columns([4, 1.5])
            with col_add_btn:
                if st.button("➕ Add LLM", use_container_width=True):
                    st.session_state.editing_llms.append({
                        "provider": "Gemini",
                        "api_key": "",
                        "model": "Auto"
                    })
                    st.rerun()

            st.markdown("<div style='height: 10px;'></div>", unsafe_allow_html=True)
            st.markdown(
                "<div style='font-size: 14.5px; margin-bottom: 8px; color: #8E9297 !important;'>"
                "ℹ️ Need Jina Key? "
                "<a href='https://jina.ai/reader/' target='_blank' style='color: #25D366 !important; font-weight: 600;'>Get Jina Reader Key</a>"
                "</div>",
                unsafe_allow_html=True
            )
            jina_help = (
                "**Step-by-Step Guide to get a Jina Reader API Key:**\n\n"
                "Jina Reader converts URL links in applicant messages into clean markdown text for the LLM to analyze.\n"
                "1. Go to [Jina Reader API](https://jina.ai/reader/).\n"
                "2. Log in or create a free account.\n"
                "3. Copy your API token from the dashboard.\n"
                "4. Paste it in the field below."
            )
            jina_key = st.text_input(
                "Jina Reader API Key (Optional)",
                value=default_jina,
                type="password",
                key=f"profile_jina_key_{editing_profile}",
                help=jina_help
            )
            
            st.markdown("##### 🔔 Notification Settings")
            # Parse country code and number from target_phone
            default_cc = "+92"
            default_phone_num = ""
            default_custom_cc = "+"
            
            # Extract dialing codes from COUNTRIES sorted by length descending to match the longest prefix first
            unique_dial_codes = sorted(list(set(item[2] for item in COUNTRIES)), key=len, reverse=True)
            
            if not is_new:
                target_phone_val = p_info.get("target_phone", "")
                if target_phone_val:
                    target_phone_val = target_phone_val.replace(" ", "").replace("-", "")
                    # Match standard codes
                    for cc in unique_dial_codes:
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
            
            # Dynamic list of display strings for selectbox
            cc_display_options = []
            option_to_val = {}
            
            for country_name, iso_code, dial_code in COUNTRIES:
                display_str = f"{country_name} ({dial_code})"
                cc_display_options.append(display_str)
                option_to_val[display_str] = dial_code
                
            # Add Other option
            cc_display_options.append("Other")
            option_to_val["Other"] = "Other"
            
            # Determine the index for selectbox based on default_cc
            cc_index = len(cc_display_options) - 1 # Default to "Other"
            if default_cc != "Other":
                for idx, display_str in enumerate(cc_display_options):
                    if display_str.endswith(f"({default_cc})"):
                        cc_index = idx
                        break
                        
            cc_col, num_col = st.columns([1.8, 2])
            with cc_col:
                selected_option = st.selectbox(
                    "Code",
                    options=cc_display_options,
                    index=cc_index,
                    key=f"profile_cc_{editing_profile}"
                )
                selected_cc = option_to_val.get(selected_option, "Other")
                
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
            st.markdown("##### 🧑‍💼 Applicant Parameters")
            app_name = st.text_input("Full Name", value=default_app_name)
            app_nationality = st.text_input("Nationality", value=default_app_nationality)
            app_degree = st.text_input("Degree Tier & Grades", value=default_app_degree)
            app_fields = st.text_area("Target Fields of Study", value=default_app_fields)
            app_focus = st.text_area("Research Focus / Key Interests", value=default_app_focus)
            

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
                            primary_llm = st.session_state.editing_llms[0] if st.session_state.editing_llms else {"provider": "Gemini", "api_key": "", "model": "Auto"}
                            profiles[p_id] = {
                                "id": p_id,
                                "name": profile_display_name,
                                "llm_chain": st.session_state.editing_llms,
                                "llm_provider": primary_llm["provider"],
                                "llm_api_key": primary_llm["api_key"],
                                "llm_model": primary_llm["model"],
                                "gemini_key": primary_llm["api_key"] if primary_llm["provider"] == "Gemini" else "",
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
                        primary_llm = st.session_state.editing_llms[0] if st.session_state.editing_llms else {"provider": "Gemini", "api_key": "", "model": "Auto"}
                        profiles[editing_profile] = {
                            "id": editing_profile,
                            "name": profile_display_name,
                            "llm_chain": st.session_state.editing_llms,
                            "llm_provider": primary_llm["provider"],
                            "llm_api_key": primary_llm["api_key"],
                            "llm_model": primary_llm["model"],
                            "gemini_key": primary_llm["api_key"] if primary_llm["provider"] == "Gemini" else "",
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
