import json
import argparse
import pandas as pd

# Function to read a file and parse JSON
def parse_json_from_file(file_path):
    with open(file_path, 'r') as file:
        return json.load(file)

# Function to calculate duration in milliseconds
def calculate_duration(progress):
    start_time = int(progress[0]['time'])
    end_time = int(progress[-1]['time'])
    return end_time - start_time

# Function to calculate exponential moving average of throughput for each ID
def calculate_throughput(data, alpha=0.3):

    # Loop through each upload data
    for upload in data:
        id = upload['id']
        progress = upload['progress']

        # Extract time and byte counts for this progress
        byte_counts = pd.Series([progress_obj['bytecount'] for progress_obj in progress])
        times = pd.Series([progress_obj['time'] for progress_obj in progress])

        # Calculate the EMA for byte counts over time
        byte_window = byte_counts.expanding()
        time_window = times.expanding()
        print("Byte window is", byte_window)
        
        throughputs = byte_window.sum()/(time_window.max() - time_window.min())
        print("Throughputs:", throughputs)
        throughput_list = throughputs.tolist()
        

        print(throughput_list)

    return throughput_list

parser = argparse.ArgumentParser(
    prog="throughput_sma.py",
    description="Throughput calculation"
    )
parser.add_argument("serverName")
args=parser.parse_args()
# Load data from file
data = parse_json_from_file("analysis/output/" +args.serverName+"/byte_time_list.json")

# Load data from file
data = parse_json_from_file("analysis/output/" +args.serverName+"/byte_time_list.json")

# Calculate throughput by IDs
throughput_by_ids = calculate_throughput(data)

# Print throughput by IDs
print("Throughput by IDs:", throughput_by_ids)

