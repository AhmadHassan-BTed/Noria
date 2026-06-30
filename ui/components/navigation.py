import streamlit as st

def render_sidebar_navigation():
    current_page = st.session_state.get("current_page", "Profiles")

    with st.sidebar:
        with st.container(key="sidebar_top_section"):
            # Render Noria Header Logo and Styling
            st.markdown("""
<div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 5px; margin-bottom: 2px;">
    <svg width="36" height="36" viewBox="0 0 299 300" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M149.789 0C67.9177 0 1.27639 66.4656 1.24166 148.157C1.23297 174.271 8.0751 199.761 21.0734 222.228L0 299.017L78.7453 278.412C100.444 290.218 124.869 296.436 149.728 296.445H149.789C231.651 296.445 298.292 229.971 298.327 148.279C298.345 108.689 282.906 71.4631 254.861 43.4616C226.815 15.4515 189.522 0.0173223 149.789 0ZM149.789 271.423H149.737C127.587 271.423 105.853 265.473 86.8985 254.256L82.3921 251.589L35.6694 263.818L48.138 218.373L45.2032 213.714C32.8474 194.105 26.3179 171.439 26.3266 148.175C26.3526 80.2715 81.7409 25.0307 149.841 25.0307C182.819 25.0394 213.816 37.8665 237.121 61.1477C260.435 84.4202 273.26 115.366 273.251 148.27C273.225 216.173 217.837 271.423 149.789 271.423Z" fill="#25D366"/>
      <path d="M156.792 213.075L141.536 213.075L141.536 85.9421L156.792 85.9421L156.792 213.075Z" fill="#25D366"/>
      <path d="M97.9276 187.898L90.2996 174.686L200.4 111.119L208.028 124.331L97.9276 187.898Z" fill="#25D366"/>
      <path d="M90.2996 124.331L97.9276 111.119L208.028 174.686L200.4 187.898L90.2996 124.331Z" fill="#25D366"/>
      <path d="M121.032 60.403C121.032 57.0892 123.718 54.403 127.032 54.403H171.296C174.609 54.403 177.296 57.0892 177.296 60.403V65.9421C177.296 76.9878 168.341 85.9421 157.296 85.9421H141.032C129.986 85.9421 121.032 76.9878 121.032 65.9421V60.403Z" fill="#212121" stroke="#25D366" stroke-width="16"/>
      <path d="M121.032 219.075C121.032 215.761 123.718 213.075 127.032 213.075H171.296C174.609 213.075 177.296 215.761 177.296 219.075V224.614C177.296 235.66 168.341 244.614 157.296 244.614H141.032C129.986 244.614 121.032 235.66 121.032 224.614V219.075Z" fill="#212121" stroke="#25D366" stroke-width="16"/>
      <path d="M51.5605 103.653C51.5605 100.339 54.2468 97.6532 57.5605 97.6532H101.824C105.138 100.339 107.824 100.339 107.824 103.653V109.192C107.824 120.238 98.87 129.192 87.8243 129.192H71.5605C60.5148 129.192 51.5605 120.238 51.5605 109.192V103.653Z" fill="#212121" stroke="#25D366" stroke-width="16"/>
      <path d="M190.503 103.653C190.503 100.339 193.189 97.6532 196.503 97.6532H240.767C244.081 97.6532 246.767 100.339 246.767 103.653V109.192C246.767 120.238 237.813 129.192 226.767 129.192H210.503C199.457 129.192 190.503 120.238 190.503 109.192V103.653Z" fill="#212121" stroke="#25D366" stroke-width="16"/>
      <path d="M51.5605 175.825C51.5605 172.511 54.2468 169.825 57.5605 169.825H101.824C105.138 169.825 107.824 172.511 107.824 175.825V181.364C107.824 192.41 98.87 201.364 87.8243 201.364H71.5605C60.5148 201.364 51.5605 192.41 51.5605 181.364V175.825Z" fill="#212121" stroke="#25D366" stroke-width="16"/>
      <path d="M190.503 175.825C190.503 172.511 193.189 169.825 196.503 169.825H240.767C244.081 169.825 246.767 172.511 246.767 175.825V181.364C246.767 192.41 237.813 201.364 226.767 201.364H210.503C199.457 201.364 190.503 192.41 190.503 181.364V175.825Z" fill="#212121" stroke="#25D366" stroke-width="16"/>
    </svg>
    <span style="color: #FFFFFF; font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 23px; letter-spacing: 0.5px;">Noria</span>
</div>
<div style="font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #8E9297; text-align: center; margin-bottom: 14px;">Agentic Control Center</div>
<div style="height: 1px; background: rgba(255, 255, 255, 0.05); margin-bottom: 14px;"></div>
""", unsafe_allow_html=True)

            # Navigation Buttons
            if st.button(" Applicant Profiles", use_container_width=True, type="primary" if current_page == "Profiles" else "secondary"):
                st.session_state.current_page = "Profiles"
                st.rerun()

            if st.button(" Opportunity Scans", use_container_width=True, type="primary" if current_page == "Scans" else "secondary"):
                st.session_state.current_page = "Scans"
                st.rerun()

            if st.button(" System Settings", use_container_width=True, type="primary" if current_page == "Settings" else "secondary"):
                st.session_state.current_page = "Settings"
                st.rerun()

            # Sidebar Content Panels
            st.markdown("""
<div style="height: 1px; background: rgba(255, 255, 255, 0.05); margin: 18px 0;"></div>

<div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); border-left: 3px solid #25D366; border-radius: 6px; padding: 10px 12px; margin-bottom: 8px;">
    <div style="font-family: 'Outfit', sans-serif; font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #25D366; margin-bottom: 4px;">About</div>
    <div style="font-family: 'Inter', sans-serif; font-size: 13px; line-height: 1.5; color: #8E9297;">
        Agentic extractor for messaging platforms. Receives messages & URLs; scrapes & evaluates content against scoring matrices; sends structured summaries with match scores.
    </div>
</div>

<div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); border-left: 3px solid #25D366; border-radius: 6px; padding: 10px 12px; margin-bottom: 0px;">
    <div style="font-family: 'Outfit', sans-serif; font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #25D366 !important; margin-bottom: 4px;">Workspace Control</div>
    <div style="font-family: 'Inter', sans-serif; font-size: 13px; line-height: 1.5; color: #8E9297 !important;">
        Manage your applicant profiles, API keys, and opportunity scans from this unified dashboard.
    </div>
</div>

""", unsafe_allow_html=True)

        with st.container(key="sidebar_bottom_section"):
            st.markdown("""
<div class="sidebar-footer">
    Designed & Engineered by <br>
    <a href="https://github.com/AhmadHassan-BTed" target="_blank" style="font-size: 14px; color: #25D366 !important;">Ahmad Hassan (B-Ted)</a><br>
    <span style="font-size: 11px; color: #8E9297 !important; display: block; margin-top: 6px; font-weight: 500;">Version <strong style="color: #25D366 !important;">1.1.0</strong></span>
</div>
""", unsafe_allow_html=True)
