# Base directory containing serverName folders
$BaseDir = "CARROT_multi"
$Server = "ookla"
# Python script to execute
$NodeScript = "netlog.js"
$ThroughputScript = "throughput_with_plot_multi.py"
# Check if the Python script exists
if (-Not (Test-Path $NodeScript)) {
    Write-Output "Error: Node script '$NodeScript' not found!"
    exit 1
}
if (-Not (Test-Path $NodeScript)) {
    Write-Output "Error: Python script '$ThroughputScript' not found!"
    exit 1
}

# Check if the base directory exists
if (-Not (Test-Path $BaseDir)) {
    Write-Output "Error: Base directory '$BaseDir' not found!"
    exit 1
}

Write-Output "Starting traversal of $BaseDir"

# Get all directories in the BaseDir - MeasurementType is download or upload
$MeasurementTypes = Get-ChildItem -Path $BaseDir -Directory

# Each $Type is download or upload
foreach ($MeasurementType in $MeasurementTypes) {
    # $Type = $MeasurementType.Name
    # Extract the server name from the directory
    Write-Output "Processing Main folder: $MeasurementType"
    $Dirs = Get-ChildItem -Path $BaseDir/$MeasurementType/ -Directory
    foreach ($Dir in $Dirs) {
        Write-Output "Processing folders: $Dir"

            $Process = Start-Process -FilePath "node" `
                -ArgumentList "$NodeScript $BaseDir/$MeasurementType/$Dir $server" `
                -NoNewWindow -PassThru -Wait
                    # Optional: If throughput is being calculated in a separate script (e.g., Python), you can call that script here:
            $ThroughputProcess = Start-Process -FilePath "python" `
                -ArgumentList "$ThroughputScript $BaseDir/$MeasurementType/$Dir" `
                -NoNewWindow -PassThru -Wait
    }
}


Write-Output "All serverNames processed."
