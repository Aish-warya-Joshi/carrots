# Base directory containing serverName folders
$BaseDir = "servers"

# Python script to execute
$NodeScript = "netlog.js"
$ThroughputScript = "throughput_with_plot.py"
# Check if the Python script exists
if (-Not (Test-Path $NodeScript)) {
    Write-Output "Error: Python script '$NodeScript' not found!"
    exit 1
}

# Check if the base directory exists
if (-Not (Test-Path $BaseDir)) {
    Write-Output "Error: Base directory '$BaseDir' not found!"
    exit 1
}

Write-Output "Starting traversal of $BaseDir"

# Get all directories in the BaseDir
$ServerDirectories = Get-ChildItem -Path $BaseDir -Directory

foreach ($ServerDir in $ServerDirectories) {
    $ServerName = $ServerDir.Name
    # Extract the server name from the directory
    $ServerFiles = Get-ChildItem -Path $BaseDir/$ServerDir -Directory

    foreach ($ServerFile in $ServerFiles) {
        $ServerExps = Get-ChildItem -Path $BaseDir/$ServerDir/$ServerFile -Directory
        foreach ($ServerExp in $ServerExps) {
            Write-Output "Processing serverFile: $BaseDir/$ServerFile/$ServerExp/output"
            $Process = Start-Process -FilePath "node" `
                -ArgumentList "$NodeScript $BaseDir/$ServerName/$ServerFile/$ServerExp/output $ServerName" `
                -NoNewWindow -PassThru -Wait
                    # Optional: If throughput is being calculated in a separate script (e.g., Python), you can call that script here:
            $ThroughputProcess = Start-Process -FilePath "python" `
                -ArgumentList "$ThroughputScript $BaseDir/$ServerName/$ServerFile/$ServerExp/output" `
                -NoNewWindow -PassThru -Wait
        }
    }

    # # Run the Python script with the server name as an argument
    # $Process = Start-Process -FilePath "python" -ArgumentList "$PythonScript $ServerName" -NoNewWindow -PassThru -Wait
    
    # # Check the exit code of the Python script
    # if ($Process.ExitCode -ne 0) {
    #     Write-Output "Error: Python script failed for $ServerName"
    # } else {
    #     Write-Output "Successfully processed $ServerName"
    # }
}

Write-Output "All serverNames processed."
