import json
import argparse
import os
import sys
import pandas as pd
from collections import defaultdict
from matplotlib import pyplot as plt

# Function to load JSON files from a given filepath
def load_json(filepath):
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"File not found: {filepath}")
    with open(filepath, 'r') as f:
        return json.load(f)

# Set up argument parsing to allow a base path as input
parser = argparse.ArgumentParser(description='Process byte time and latency JSON files.')
parser.add_argument('base_path', type=str, help='Base path to the JSON files')

args = parser.parse_args()
# Ensure only one argument is provided
if len(sys.argv) > 2:  # sys.argv[0] is the script name, so we check if there are extra args
    parser.error(f"Too many arguments provided. Expected 1 argument, but got {len(sys.argv) - 1}.")

# Print base path and working directory for debugging
print(f"Provided Base Path: {args.base_path}")
print(f"Current Working Directory: {os.getcwd()}")

# Construct the full file paths by appending the specific filenames
byte_file = os.path.abspath(os.path.join(args.base_path, "byte_time_list.json"))
current_file = os.path.abspath(os.path.join(args.base_path, "current_position_list.json"))
latency_file = os.path.abspath(os.path.join(args.base_path, "latency.json"))

# Debugging: Print the constructed paths
print(f"Byte Time File: {byte_file}")
print(f"Current Position File: {current_file}")
print(f"Latency File: {latency_file}")
# Check and load files
for file_path in [byte_file, current_file, latency_file]:
    print(f"Checking: {file_path}")
    if not os.path.exists(file_path):
        print(f"ERROR: File not found - {file_path}")
    else:
        print(f"File exists: {file_path}")
# Print the full paths (just to verify)
print(f'Byte Time File: {os.path.join(args.base_path,"byte_time_list.json")}')
print(f'Current Time File: {os.path.join(args.base_path, "current_position_list.json")}')
print(f'Latency File: {os.path.join(args.base_path,"latency.json")}')

# Load the JSON files
byte_list = load_json(byte_file)

if byte_list == []:
    current_list = load_json(current_file)

    # Transform cumulative data into incremental byte data
    byte_list = []
    for item in current_list:
        new_progress = []
        prev_position = 0  # Initialize the previous position

        for progress in item["progress"]:
            current_position = progress["current_position"]
            time = progress["time"]

            # Calculate the difference to get incremental bytes
            bytes_transferred = current_position - prev_position
            prev_position = current_position  # Update previous position

            # Add the incremental data to the new progress list
            new_progress.append({"bytecount": bytes_transferred, "time": time})

        # Append the transformed item to the uncumulated list
        byte_list.append({
            "id": item["id"],
            "type": item["type"],
            "progress": new_progress
        })

else:
    # Load the latency file
    latency_data = load_json(latency_file)

    # Create a dictionary to map IDs to their 0th time from the latency file
    latency_time_map = {entry['sourceID']: int(entry['recv_time'][0]) for entry in latency_data}

    # Step 1: Aggregate unique time into one list
    for entry in byte_list:
        id = entry['id']
        progress = entry['progress']
        # If the ID exists in the latency map, prepend the 0th time entry
        if id in latency_time_map:
            zero_time_entry = {
                "time": latency_time_map[id],  # 0th time from latency file
                "bytecount": 0  # Default bytecount for the starting point
            }
            progress.insert(0, zero_time_entry)  # Prepend to the progress list
# Initialize aggregated list
aggregated_time = []
for entry in byte_list:
    progress = entry['progress']
    for item in progress:
        if int(item['time']) not in aggregated_time:
            aggregated_time.append(
                int(item['time']),
                )
aggregated_time.sort()
byte_count = {}
begin_time = aggregated_time[0]
for entry in byte_list:
    end_time = -1
    start_time = -1
    for i in range(len(aggregated_time[1:])):
        current_list_time = aggregated_time[i]
        prev_list_time = aggregated_time[i-1]
        id = entry['id']
        progress = entry['progress']
        for item in progress:
            if (end_time != -1 and start_time!= -1):
                continue
            if ((int(item['time']) > prev_list_time) and start_time==-1):
                continue
            if (int(item['time']) <= prev_list_time):
                start_time = int(item['time'])
            elif (int(item['time']) >= current_list_time):
                end_time = int(item['time'])
            if (end_time != -1):
                if current_list_time in byte_count:
                    byte_count[current_list_time]+=int(item['bytecount'])*((current_list_time-prev_list_time)/(end_time-start_time))
                else:
                    byte_count[current_list_time]=int(item['bytecount'])*((current_list_time-prev_list_time)/(end_time-start_time))
        start_time = -1
        end_time = -1

throughput_results=[]

for i in range(len(aggregated_time[1:])):
    current_list_time = aggregated_time[i]
    prev_list_time = aggregated_time[i-1]
    if current_list_time in byte_count:
        throughput = byte_count[current_list_time]/((current_list_time-prev_list_time)/1000)
        throughput_results.append({
                    "time": (current_list_time - begin_time)/1000,  # Total time since begin_time
                    "throughput": throughput*(8/1000000)  # Convert to Mbps
                })

# # Convert throughput results to DataFrame
df = pd.DataFrame(throughput_results)
# If 'throughput' exists, calculate Exponential Moving Average (EMA)
if 'throughput' in df.columns:
    df['throughput_ema'] = df['throughput'].ewm(alpha=0.1, adjust=False).mean()

    # Plot throughput EMA over time
    plt.figure()
    # plt.plot(df['time'], df['throughput'], color='lightblue', marker='o', alpha=0.5, label='Individual Throughput for each time')

    plt.plot(df['time'], df['throughput_ema'],color='red', linestyle='--', label='REMA Throughput')
    plt.xlabel('Time (in seconds)')
    plt.ylabel('Throughput (in Mbps)')
    plt.title(f"{args.base_path.split('/')[-1]}")
    plt.legend()
    # plt.savefig(args.base_path + '/throughput_ema_plot.jpg')
    plt.savefig(f"plots/{args.base_path.split('/')[-1]}.jpg")
    # print(f"{args.base_path.split('/')[-2]}.jpg")
    # plt.show()
else:
    print("No throughput data available for plotting.")
