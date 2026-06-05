import os
import subprocess
import shutil

def main():
    local_dir = "C:\\Users\\PMLS\\AppData\\Local\\Temp\\noria_build"
    workspace_dir = "P:\\noria"
    
    # 1. Ensure local temp dir exists
    os.makedirs(local_dir, exist_ok=True)
    
    # 2. Copy source and icon locally to C:
    local_source = os.path.join(local_dir, "launcher.cs")
    local_icon = os.path.join(local_dir, "noria-logo.ico")
    local_exe = os.path.join(local_dir, "Noria.exe")
    
    shutil.copyfile(os.path.join(workspace_dir, "scripts", "launcher.cs"), local_source)
    shutil.copyfile(os.path.join(workspace_dir, "docs", "images", "noria-logo.ico"), local_icon)
    
    # 3. Compile C# launcher locally
    csc_path = "C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe"
    
    print("[Build] Compiling C# launcher locally on C: drive...")
    cmd = [
        csc_path,
        "/target:exe",
        f"/out:{local_exe}",
        f"/win32icon:{local_icon}",
        local_source
    ]
    
    print(f"[Build] Running C# Compiler: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode == 0:
        # 4. Copy the compiled EXE back to the workspace dist/ folder
        dist_dir = os.path.join(workspace_dir, "dist")
        os.makedirs(dist_dir, exist_ok=True)
        
        dest_exe = os.path.join(dist_dir, "Noria.exe")
        
        print(f"[Build] Copying compiled executable: {local_exe} -> {dest_exe}")
        shutil.copyfile(local_exe, dest_exe)
        
        # Clean up old root executables and redundant launcher versions if they exist
        root_exe = os.path.join(workspace_dir, "Noria.exe")
        root_exe_launcher = os.path.join(workspace_dir, "NoriaLauncher.exe")
        dist_exe_launcher = os.path.join(dist_dir, "NoriaLauncher.exe")
        
        for file_path in [root_exe, root_exe_launcher, dist_exe_launcher]:
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception:
                    pass
                
        print("[Build] Standalone Noria.exe compiled successfully with custom icon in dist/ folder!")
    else:
        print(f"[Build Error] csc.exe failed with exit code: {result.returncode}")
        print("\nSTDOUT:")
        print(result.stdout)
        print("\nSTDERR:")
        print(result.stderr)

if __name__ == "__main__":
    main()
