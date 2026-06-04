import streamlit as st

def apply_custom_styles():
    # Streamlit Page Config & Custom Styling (WhatsApp Dark Theme)
    st.set_page_config(
        page_title="Noria — Control Center",
        page_icon="📡",
        layout="wide",
        initial_sidebar_state="expanded",
        menu_items={
            'About': '''
# Noria — Control Center
An agentic extractor for messaging platforms.

To run this app:
```bash
streamlit run app.py
```
'''
        }
    )

    # Premium Custom CSS — WhatsApp Dark Theme (#212121 / #25D366 / #FFFFFF)
    # Density-optimized spatial composition with 4px-based spacing scale
    st.markdown("""
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap');

        /* =============================================================
           DESIGN SYSTEM TOKENS
           ============================================================= */
        :root {
            /* Backgrounds — 3-tier elevation */
            --bg-page: #212121;
            --bg-level-1: #2B2B2B;
            --bg-level-2: #1E1E1E;
            --bg-level-3: #121212;

            /* Borders — progressive contrast */
            --border-level-1: #2D2D2D;
            --border-level-2: #383838;
            --border-level-3: #444444;

            /* Typography */
            --text-color: #FFFFFF;
            --text-secondary: #B0B3B8;
            --text-muted: #8E9297;
            --text-dim: #6B6E73;

            /* Brand */
            --whatsapp-green: #25D366;
            --whatsapp-green-hover: #20ba5a;
            --whatsapp-green-alpha: rgba(37, 211, 102, 0.06);
            --whatsapp-green-border: rgba(37, 211, 102, 0.15);

            /* Spacing scale (4px base) */
            --space-xs: 6px;
            --space-sm: 10px;
            --space-md: 16px;
            --space-lg: 24px;
            --space-xl: 32px;

            /* Radii */
            --radius-sm: 6px;
            --radius-md: 8px;
            --radius-lg: 10px;
        }

        /* =============================================================
           GLOBAL RESETS & STREAMLIT SPACING OVERRIDES
           ============================================================= */
        html, body, [class*="css"], .stApp {
            font-family: 'Inter', sans-serif !important;
            background-color: var(--bg-page) !important;
            color: var(--text-color) !important;
        }

        /* Reduce Streamlit's default top padding (~6rem → 2.5rem) */
        .block-container {
            padding-top: 2.5rem !important;
            padding-bottom: 1.5rem !important;
        }

        /* Reduce vertical gap between Streamlit elements (default ~1rem → 0.65rem) */
        div[data-testid="stVerticalBlock"] > div {
            margin-bottom: 0.65rem !important;
        }

        /* Give containers and expanders more breathing room */
        div[data-testid="stVerticalBlock"] > div:has(> div[data-testid="stVerticalBlockBorderWrapper"]),
        div[data-testid="stVerticalBlock"] > div:has(> div[data-testid="stExpander"]) {
            margin-bottom: var(--space-lg) !important;
        }

        /* Section headers (h4, h5) get top breathing room for visual separation */
        h4 {
            margin-top: var(--space-lg) !important;
            padding-top: var(--space-sm) !important;
        }
        h5 {
            margin-top: var(--space-md) !important;
            padding-top: var(--space-xs) !important;
        }

        /* Horizontal column gaps — slightly tighter than default */
        div[data-testid="stHorizontalBlock"] {
            gap: var(--space-md) !important;
        }

        /* Markdown paragraph spacing — compact but readable */
        div[data-testid="stMarkdown"] p {
            font-size: 13.5px !important;
            font-weight: 400 !important;
            color: var(--text-color) !important;
            margin-bottom: 8px !important;
            line-height: 1.6 !important;
        }

        /* Caption styling override to fix contrast/opacity issues */
        div[data-testid="stCaptionContainer"] {
            font-size: 12px !important;
            color: var(--text-secondary) !important;
            margin-top: 2px !important;
            margin-bottom: 6px !important;
            line-height: 1.4 !important;
        }

        /* Dividers */
        hr {
            margin-top: var(--space-lg) !important;
            margin-bottom: var(--space-lg) !important;
            border-color: var(--border-level-1) !important;
            opacity: 0.4 !important;
        }


        /* =============================================================
           HEADER & DECORATION
           ============================================================= */
        header[data-testid="stHeader"] {
            background-color: var(--bg-page) !important;
            border-bottom: 1px solid var(--border-level-1) !important;
        }

        header[data-testid="stHeader"] * {
            color: var(--text-color) !important;
        }

        div[data-testid="stDecoration"] {
            background-image: linear-gradient(90deg, var(--whatsapp-green), var(--whatsapp-green-hover)) !important;
        }

        /* =============================================================
           TYPOGRAPHY — Tightened scale
           ============================================================= */
        h1 {
            font-family: 'Outfit', sans-serif !important;
            font-size: 24px !important;
            font-weight: 700 !important;
            color: var(--text-color) !important;
            margin-bottom: var(--space-sm) !important;
            line-height: 1.3 !important;
        }

        h2 {
            font-family: 'Outfit', sans-serif !important;
            font-size: 19px !important;
            font-weight: 600 !important;
            color: var(--text-color) !important;
            margin-bottom: var(--space-sm) !important;
            line-height: 1.4 !important;
        }

        h3 {
            font-family: 'Outfit', sans-serif !important;
            font-size: 16px !important;
            font-weight: 600 !important;
            color: var(--text-color) !important;
            margin-bottom: var(--space-xs) !important;
            line-height: 1.4 !important;
        }

        h4 {
            font-family: 'Outfit', sans-serif !important;
            font-size: 13px !important;
            font-weight: 600 !important;
            color: var(--whatsapp-green) !important;
            margin-bottom: var(--space-xs) !important;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            line-height: 1.4 !important;
        }

        h5 {
            font-family: 'Outfit', sans-serif !important;
            font-size: 12px !important;
            font-weight: 600 !important;
            color: var(--text-secondary) !important;
            margin-bottom: var(--space-xs) !important;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            line-height: 1.4 !important;
        }

        h6 {
            font-family: 'Outfit', sans-serif !important;
            font-size: 11px !important;
            font-weight: 600 !important;
            color: var(--text-muted) !important;
            margin-bottom: var(--space-xs) !important;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            line-height: 1.4 !important;
        }

        /* =============================================================
           SIDEBAR
           ============================================================= */
        [data-testid="stSidebar"] {
            background: linear-gradient(180deg, #181818 0%, #0F0F0F 100%) !important;
            border-right: 1px solid rgba(255, 255, 255, 0.05) !important;
        }

        [data-testid="stSidebarContent"] {
            overflow: hidden !important;
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
        }

        [data-testid="stSidebarContent"]::-webkit-scrollbar {
            width: 0 !important;
            height: 0 !important;
            display: none !important;
        }

        [data-testid="stSidebarUserContent"] {
            height: 100dvh !important;
            max-height: 100dvh !important;
            padding-top: 20px !important;
            padding-bottom: 20px !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
        }

        [data-testid="stSidebarUserContent"] > div[data-testid="stVerticalBlock"] {
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            height: 100% !important;
            min-height: 0 !important;
            gap: 0 !important;
            box-sizing: border-box !important;
        }

        [data-testid="stSidebarUserContent"] > div[data-testid="stVerticalBlock"] > div {
            margin-bottom: 0 !important;
        }

        [data-testid="stSidebarUserContent"] > div[data-testid="stVerticalBlock"] > div:has(.st-key-sidebar_bottom_section) {
            margin-top: auto !important;
            padding-top: 24px !important;
        }

        [data-testid="stSidebar"] div.st-key-sidebar_top_section,
        [data-testid="stSidebar"] div.st-key-sidebar_bottom_section {
            width: 100% !important;
            flex: 0 0 auto !important;
        }

        [data-testid="stSidebar"] div.st-key-sidebar_bottom_section {
            margin-top: auto !important;
            padding-top: 24px !important;
        }

        /* Sidebar elements spacing */
        [data-testid="stSidebar"] div.stButton {
            margin-bottom: 0 !important;
        }

        /* =============================================================
           SIDEBAR FOOTER
           ============================================================= */
        .sidebar-footer {
            margin-top: 0px !important;
            border-top: 1px solid rgba(255, 255, 255, 0.05) !important;
            padding-top: 15px !important;
            padding-bottom: 10px !important;
            text-align: center !important;
            font-family: 'Inter', sans-serif !important;
            font-size: 11px !important;
            color: var(--text-muted) !important;
            line-height: 1.45 !important;
        }

        .sidebar-footer a {
            color: var(--whatsapp-green) !important;
            text-decoration: none !important;
            font-weight: 600 !important;
            font-family: 'Outfit', sans-serif !important;
        }

        .sidebar-footer a:hover {
            color: var(--whatsapp-green-hover) !important;
        }

        [data-testid="stSidebar"] * {
            color: var(--text-color) !important;
        }

        [data-testid="stSidebar"],
        [data-testid="stSidebarContent"],
        [data-testid="stSidebarUserContent"] {
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
        }

        [data-testid="stSidebar"]::-webkit-scrollbar,
        [data-testid="stSidebarContent"]::-webkit-scrollbar,
        [data-testid="stSidebarUserContent"]::-webkit-scrollbar {
            width: 0 !important;
            height: 0 !important;
            display: none !important;
        }

        /* Sidebar info boxes */
        [data-testid="stSidebar"] div[data-testid="stAlert"] {
            background: rgba(255, 255, 255, 0.01) !important;
            border: 1px solid rgba(255, 255, 255, 0.04) !important;
            border-left: 3px solid var(--whatsapp-green) !important;
            border-radius: var(--radius-sm) !important;
            padding: var(--space-sm) var(--space-md) !important;
            margin-top: var(--space-md) !important;
        }

        [data-testid="stSidebar"] div[data-testid="stAlert"] div {
            color: var(--text-muted) !important;
            font-size: 12px !important;
            line-height: 1.45 !important;
        }

        /* Sidebar nav buttons (inactive) */
        [data-testid="stSidebar"] div.stButton > button {
            width: 100% !important;
            text-align: left !important;
            border-radius: var(--radius-sm) !important;
            border: 1px solid transparent !important;
            border-left: 3px solid transparent !important;
            background-color: transparent !important;
            color: var(--text-muted) !important;
            margin-bottom: 2px !important;
            padding: var(--space-sm) var(--space-md) !important;
            font-weight: 500 !important;
            font-size: 13px !important;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }

        [data-testid="stSidebar"] div.stButton > button:hover {
            border-color: rgba(255, 255, 255, 0.05) !important;
            border-left: 3px solid rgba(37, 211, 102, 0.5) !important;
            color: var(--text-color) !important;
            background-color: rgba(255, 255, 255, 0.02) !important;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15) !important;
            transform: translateX(3px) !important;
        }

        /* Sidebar nav active */
        [data-testid="stSidebar"] div.stButton > button[kind="primary"] {
            background-color: var(--whatsapp-green-alpha) !important;
            color: var(--whatsapp-green) !important;
            border: 1px solid var(--whatsapp-green-border) !important;
            border-left: 3px solid var(--whatsapp-green) !important;
            border-radius: var(--radius-sm) !important;
            font-weight: 600 !important;
            font-size: 13px !important;
            box-shadow: inset 0 0 8px rgba(37, 211, 102, 0.04), 0 2px 8px rgba(0, 0, 0, 0.2) !important;
            transform: translateX(3px) !important;
        }

        [data-testid="stSidebar"] div.stButton > button[kind="primary"]:hover {
            background-color: rgba(37, 211, 102, 0.1) !important;
            color: var(--whatsapp-green) !important;
            border-color: rgba(37, 211, 102, 0.25) !important;
            border-left: 3px solid var(--whatsapp-green) !important;
            box-shadow: inset 0 0 8px rgba(37, 211, 102, 0.06), 0 2px 10px rgba(37, 211, 102, 0.12) !important;
            transform: translateX(3px) !important;
        }

        /* =============================================================
           ROOT CONTAINER RESET
           ============================================================= */
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] {
            border: none !important;
            background-color: transparent !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
        }

        /* =============================================================
           LEVEL 1 CONTAINERS — Profile cards, expander list items
           ============================================================= */
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] > div > div > div[data-testid="stVerticalBlockBorderWrapper"],
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] > div > div > div[data-testid="stExpander"] {
            border: 1px solid var(--border-level-1) !important;
            border-radius: var(--radius-lg) !important;
            background-color: var(--bg-level-1) !important;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
            padding: var(--space-lg) !important;
            margin-bottom: var(--space-lg) !important;
            transition: border-color 0.2s ease-in-out !important;
        }

        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] > div > div > div[data-testid="stVerticalBlockBorderWrapper"]:hover,
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] > div > div > div[data-testid="stExpander"]:hover {
            border-color: var(--border-level-2) !important;
        }

        /* Level 1 Expander details & summary */
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] > div > div > div[data-testid="stExpander"] > details {
            border: none !important;
            background: transparent !important;
        }

        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] > div > div > div[data-testid="stExpander"] summary {
            background-color: var(--bg-level-1) !important;
            color: var(--text-color) !important;
            font-family: 'Outfit', sans-serif !important;
            font-weight: 600 !important;
            font-size: 18px !important;
            padding: var(--space-md) var(--space-lg) !important;
            border-radius: var(--radius-lg) !important;
            transition: color 0.2s ease-in-out !important;
        }

        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] > div > div > div[data-testid="stExpander"] summary p {
            font-size: 18px !important;
            font-weight: 600 !important;
        }

        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] > div > div > div[data-testid="stExpander"] summary:hover {
            color: var(--whatsapp-green) !important;
        }
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] > div > div > div[data-testid="stExpander"] summary:hover svg {
            color: var(--whatsapp-green) !important;
            fill: currentColor !important;
        }

        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] > div > div > div[data-testid="stExpander"] details[open] summary {
            border-bottom: 1px solid var(--border-level-1) !important;
            border-bottom-left-radius: 0 !important;
            border-bottom-right-radius: 0 !important;
        }

        /* =============================================================
           LEVEL 2 CONTAINERS — Device cards, sub-sections
           ============================================================= */
        /* Device header toggle buttons */
        div[class*="st-key-dev_hdr_btn"] button {
            background-color: var(--bg-level-2) !important;
            color: var(--text-color) !important;
            border: 1px solid var(--border-level-2) !important;
            border-radius: var(--radius-md) !important;
            text-align: left !important;
            justify-content: flex-start !important;
            font-family: 'Outfit', sans-serif !important;
            font-weight: 600 !important;
            font-size: 13px !important;
            padding: var(--space-sm) var(--space-md) !important;
            margin-bottom: -8px !important;
        }

        div[class*="st-key-dev_hdr_btn"] button:hover {
            color: var(--whatsapp-green) !important;
            border-color: var(--whatsapp-green) !important;
            background-color: var(--border-level-1) !important;
        }

        /* Nested containers (Level 2 sub-cards) */
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] div[data-testid="stVerticalBlockBorderWrapper"],
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] {
            background-color: var(--bg-level-2) !important;
            border: 1px solid var(--border-level-2) !important;
            border-radius: var(--radius-md) !important;
            box-shadow: none !important;
            padding: var(--space-md) !important;
            margin-top: var(--space-sm) !important;
            margin-bottom: var(--space-sm) !important;
        }

        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] div[data-testid="stVerticalBlockBorderWrapper"]:hover,
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"]:hover {
            border-color: var(--whatsapp-green) !important;
        }

        /* Expanders inside Level 1 (log expanders) */
        div[data-testid="stExpander"] div[data-testid="stExpander"] {
            background-color: var(--bg-level-2) !important;
            border: 1px solid var(--border-level-2) !important;
            border-radius: var(--radius-md) !important;
        }

        div[data-testid="stExpander"] div[data-testid="stExpander"] summary {
            background-color: var(--bg-level-2) !important;
            border-radius: var(--radius-md) !important;
            padding: var(--space-sm) var(--space-md) !important;
            font-size: 13px !important;
        }

        /* =============================================================
           LEVEL 3 CONTAINERS — Code/log panels, inner blocks
           ============================================================= */
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"],
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] {
            background-color: var(--bg-level-3) !important;
            border: 1px solid var(--border-level-3) !important;
            box-shadow: none !important;
            padding: var(--space-md) !important;
        }

        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"]:hover,
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"]:hover {
            border-color: var(--whatsapp-green) !important;
        }

        /* =============================================================
           BUTTONS — Compact density
           ============================================================= */
        button {
            border-radius: var(--radius-sm) !important;
            font-weight: 500 !important;
            font-size: 13px !important;
            padding: 6px 12px !important;
            transition: all 0.2s ease-in-out !important;
        }

        button[kind="primary"] {
            background-color: var(--whatsapp-green) !important;
            color: #121212 !important;
            border: 1px solid var(--whatsapp-green) !important;
            font-weight: 600 !important;
        }

        button[kind="primary"]:hover {
            background-color: var(--whatsapp-green-hover) !important;
            color: #121212 !important;
            box-shadow: 0 2px 8px rgba(37, 211, 102, 0.25) !important;
            transform: translateY(-1px);
        }

        button[kind="secondary"] {
            background-color: #2D2D2D !important;
            color: var(--text-secondary) !important;
            border: 1px solid var(--border-level-2) !important;
        }

        button[kind="secondary"]:hover {
            border-color: var(--whatsapp-green) !important;
            color: var(--whatsapp-green) !important;
            background-color: #333333 !important;
            box-shadow: 0 2px 6px rgba(37, 211, 102, 0.08) !important;
        }

        /* =============================================================
           INPUTS & FORM FIELDS
           ============================================================= */
        div[data-baseweb="input"], div[data-baseweb="textarea"], div[data-baseweb="select"] {
            background-color: var(--bg-level-2) !important;
            border: 1px solid var(--border-level-1) !important;
            border-radius: var(--radius-sm) !important;
            color: var(--text-color) !important;
        }

        /* Inputs inside Level 2 */
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-baseweb="input"],
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] div[data-baseweb="input"],
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-baseweb="textarea"],
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] div[data-baseweb="textarea"],
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-baseweb="select"],
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] div[data-baseweb="select"] {
            background-color: var(--bg-level-3) !important;
            border-color: var(--border-level-2) !important;
        }

        input, textarea, select {
            color: var(--text-color) !important;
            background-color: transparent !important;
            font-size: 13px !important;
        }

        div[data-baseweb="input"]:focus-within, div[data-baseweb="textarea"]:focus-within, div[data-baseweb="select"]:focus-within {
            border-color: var(--whatsapp-green) !important;
            box-shadow: 0 0 0 1px var(--whatsapp-green) !important;
        }

        /* Multi-select tag bubbles */
        span[role="button"] {
            background-color: #2D2D2D !important;
            border: 1px solid var(--border-level-2) !important;
            color: var(--text-color) !important;
            font-size: 12px !important;
        }

        /* Label styling */
        div[data-testid="stWidgetLabel"] label,
        div[data-testid="stWidgetLabel"] p {
            font-size: 13px !important;
            color: var(--text-secondary) !important;
            margin-bottom: var(--space-xs) !important;
        }

        /* =============================================================
           ALERTS — Compact
           ============================================================= */
        div[data-testid="stAlert"] {
            background-color: var(--bg-level-1) !important;
            border: 1px solid var(--border-level-1) !important;
            border-radius: var(--radius-md) !important;
            padding: var(--space-sm) var(--space-md) !important;
        }

        div[data-testid="stAlert"] div {
            font-size: 16px !important;
        }

        div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stAlert"] {
            background-color: var(--bg-level-2) !important;
            border-color: var(--border-level-2) !important;
        }

        div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stAlert"],
        div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] div[data-testid="stAlert"] {
            background-color: var(--bg-level-3) !important;
            border-color: var(--border-level-3) !important;
        }

        /* =============================================================
           CODE & PRE — Compact
           ============================================================= */
        code {
            color: var(--whatsapp-green) !important;
            background-color: var(--bg-level-3) !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 12.5px !important;
            padding: 1px 5px !important;
            border-radius: 3px !important;
        }

        pre {
            background-color: var(--bg-level-3) !important;
            border: 1px solid var(--border-level-2) !important;
            border-radius: var(--radius-md) !important;
            padding: var(--space-md) !important;
            box-shadow: inset 0 1px 4px rgba(0,0,0,0.3) !important;
        }

        pre code {
            padding: 0 !important;
            background-color: transparent !important;
        }

        /* =============================================================
           TOAST
           ============================================================= */
        div[data-testid="stToast"] {
            background-color: var(--bg-level-2) !important;
            color: var(--text-color) !important;
            border-left: 4px solid var(--whatsapp-green) !important;
            font-size: 13px !important;
        }

        /* =============================================================
           PROGRESS BAR
           ============================================================= */
        div[role="progressbar"] > div {
            background-color: var(--whatsapp-green) !important;
        }

        /* =============================================================
           SCROLLBARS
           ============================================================= */
        ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }
        ::-webkit-scrollbar-track {
            background: var(--bg-page);
        }
        ::-webkit-scrollbar-thumb {
            background: #3E3E3E;
            border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: var(--whatsapp-green);
        }

        /* =============================================================
           LOG VIEWER TOGGLE
           ============================================================= */
        div[class*="st-key-toggle_logs"] {
            border: 1px solid var(--border-level-3) !important;
            border-radius: var(--radius-sm) !important;
            padding: 6px var(--space-md) !important;
            background-color: var(--bg-level-3) !important;
            margin-top: var(--space-sm) !important;
            margin-bottom: var(--space-sm) !important;
            transition: all 0.2s ease-in-out !important;
        }

        div[class*="st-key-toggle_logs"]:hover {
            border-color: var(--whatsapp-green) !important;
            background-color: var(--whatsapp-green-alpha) !important;
            box-shadow: 0 1px 4px rgba(37, 211, 102, 0.05) !important;
        }

        /* =============================================================
           COLUMN BORDER/HOVER RESETS
           ============================================================= */
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="column"] div[data-testid="stVerticalBlockBorderWrapper"],
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="column"] div[data-testid="stVerticalBlockBorderWrapper"],
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stHorizontalBlock"] div[data-testid="stVerticalBlockBorderWrapper"],
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stHorizontalBlock"] div[data-testid="stVerticalBlockBorderWrapper"] {
            background-color: transparent !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
        }

        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="column"] div[data-testid="stVerticalBlockBorderWrapper"]:hover,
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="column"] div[data-testid="stVerticalBlockBorderWrapper"]:hover,
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stHorizontalBlock"] div[data-testid="stVerticalBlockBorderWrapper"]:hover,
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stHorizontalBlock"] div[data-testid="stVerticalBlockBorderWrapper"]:hover {
            border: none !important;
            border-color: transparent !important;
            box-shadow: none !important;
            background-color: transparent !important;
        }
    </style>
    """, unsafe_allow_html=True)

    # Inject client-side JS to automatically repair malformed localStorage UUID entries
    # that cause Streamlit's MetricsManager.getAnonymousId to throw JSON.parse exceptions.
    st.markdown("""
    <script>
    (function() {
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!key) continue;
                const val = localStorage.getItem(key);
                if (val && !val.startsWith('{') && !val.startsWith('[') && !val.startsWith('"')) {
                    // Check if it looks like a raw string or UUID and is a streamlit/metrics/user key
                    if (key.includes('streamlit') || key.includes('metrics') || key.includes('ajs') || key.includes('user') || key.includes('id')) {
                        localStorage.removeItem(key);
                    }
                }
            }
        } catch (e) {
            console.error("Local storage cleanup failed: ", e);
        }
    })();
    </script>
    """, unsafe_allow_html=True)
