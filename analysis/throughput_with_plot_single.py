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

    # Create a dictionary to store cleaned data for each id
    cleaned_data_by_id = {}
    throughput=[]
    relative_time=[]
    initial_time=int(current_list[0]["progress"][0]["time"])
    # Process each item's progress grouped by id
    for item in current_list:
        item_id = item["id"]  # Assuming there's an "id" field
        raw_progress = item["progress"]

        if item_id not in cleaned_data_by_id:
            cleaned_data_by_id[item_id] = {}

        for progress in raw_progress:
            time = int(progress["time"])  # Convert time to integer for calculations
            current_position = int(progress["current_position"])  # Ensure position is also an integer
            
            # Update only if the current position is the latest for that time
            cleaned_data_by_id[item_id][time] = current_position

    # Calculate throughput and prepare data for plotting
    for item_id, cleaned_data in cleaned_data_by_id.items():
        times = sorted(cleaned_data.keys())  # Ensure times are sorted
        positions = [cleaned_data[time] for time in times]

        # Calculate throughput for this id
            # Calculate throughput for this id and convert to a list
        throughput.extend([
            ((positions[i] - positions[i - 1]) / (times[i] - times[i - 1]))*(8/1000)
            for i in range(1, len(times))
        ])

        relative_time.extend([
            (t - initial_time)/1000 for t in times[1:]
        ])

    data = {'relative_time': relative_time, 'throughput': throughput}
    df = pd.DataFrame(data)

    # Calculate the Exponential Moving Average (EMA) for 'throughput'
    df['throughput_ema'] = df['throughput'].ewm(alpha=0.1, adjust=False).mean()

    # Plot the throughput and its EMA
    plt.figure()
    plt.plot(df['relative_time'], df['throughput_ema'], color='red', linestyle='--', label='EMA (α=0.1)')

    # Add labels and legend
    plt.xlabel("Relative Time (seconds)")
    plt.ylabel("Throughput (Mbps)")
    plt.title("Throughput and Exponential Moving Average (EMA) Over Time")
    plt.legend()
    plt.grid(True)
    plt.show()

else:
    latency_list = load_json(latency_file)

    # Convert latency_list to a dictionary for quick lookup by sourceID
    latency_dict = {entry['sourceID']: entry for entry in latency_list}

    # Calculate throughput with bytecount summed in chunks of 5
    throughput_results = []
    count = 0
    # Get the first key in the dictionary
    first_id = next(iter(latency_dict))
    first_entry = latency_dict[first_id]

    # Extract send_time and recv_time
    begin_time = int(first_entry['recv_time'][0])
    for entry in byte_list:
        id = entry['id']
        
        # Get the corresponding latency entry
        latency_entry = latency_dict.get(id)
        if latency_entry :
            recv_time = int(latency_entry['recv_time'][0])
    
        progress = entry['progress']
        byte_accumulator = 0
        zeroed_time = -1
        for i in range(0, len(progress), 5):
            # Select the chunk of progress
            chunk = progress[i:i+5]
            # Sum the bytecount in the chunk
            byte_sum = sum(item['bytecount'] for item in chunk)
            
            # Calculate time difference: first and last time in the chunk
            if (i == 0):
                if latency_entry is None:
                    continue  # Skip if no matching latency entry found
                time_start = recv_time
            else:
                time_start = int(chunk[0]['time'])
            
            time_end = int(chunk[-1]['time'])      


            #time is in millisecond
            time_duration = (time_end - time_start) / 1000
            
            if not latency_entry:
                begin_time = time_start
                # If the time difference is zero, accumulate bytes
            if time_duration == 0:
                byte_accumulator += byte_sum
                if zeroed_time == -1:
                    zeroed_time = time_start
                continue  # Skip throughput calculation

            # Avoid division by zero
            else:

                # Add accumulated bytes to the current chunk
                byte_sum += byte_accumulator
                byte_accumulator = 0  # Reset accumulator

                if zeroed_time != -1:
                    time_duration = time_end - zeroed_time
                    zeroed_time = -1
                throughput = byte_sum / time_duration
                throughput_results.append({
                    "id": id,
                    "time": (time_end-begin_time)/1000,  # Use the last time in the chunk for plotting
                    "throughput": (throughput)*(8/1000000)
                })
            

    print(throughput_results[0:10])

    # Convert throughput results to DataFrame
    df = pd.DataFrame(throughput_results)
    # If 'throughput' exists, calculate Exponential Moving Average (EMA)
    if 'throughput' in df.columns:
        df['throughput_ema'] = df['throughput'].ewm(alpha=0.1, adjust=False).mean()

        # Plot throughput EMA over time
        plt.figure()

        # plt.plot(df['time'], df['throughput'], color='blue', marker='o', alpha=0.5, label='Throughput')

        plt.plot(df['time'], df['throughput_ema'],color='red', linestyle='--', label='Throughput')
        plt.xlabel('Time (in seconds)')
        plt.ylabel('Throughput (in Mbps)')
        # plt.title({args.base_path.split('/')[-2]}/{args.base_path.split('/')[-1]})
        plt.legend()
        # plt.savefig(args.base_path + '/throughput_ema_plot.jpg')
        plt.savefig(f"plots/{args.base_path.split('/')[-1]}-{args.base_path.split('/')[-1]}.jpg")
        # print(f"{args.base_path.split('/')[-2]}.jpg")
        # plt.show()
    else:
        print("No throughput data available for plotting.")
