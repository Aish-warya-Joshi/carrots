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
    plt.plot(df['relative_time'], df['throughput'], color='blue', marker='o', alpha=0.5, label='Throughput')
    plt.plot(df['relative_time'], df['throughput_ema'], color='red', linestyle='--', label='EMA (α=0.1)')

    # Add labels and legend
    plt.xlabel("Relative Time (seconds)")
    plt.ylabel("Throughput (Mbps)")
    plt.title("Throughput and Exponential Moving Average (EMA) Over Time")
    plt.legend()
    plt.grid(True)
    plt.show()

else:
    # Initialize aggregated list
    aggregated_time = []

    # Step 1: Aggregate unique time into one list
    for entry in byte_list:
        id = entry['id']
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
        plt.plot(df['time'], df['throughput_ema'],color='red', linestyle='--', label='Throughput')
        plt.xlabel('Time (in seconds)')
        plt.ylabel('Throughput (in Mbps)')
        plt.title(f"{args.base_path.split('/')[-2]}-{args.base_path.split('/')[-1]}")
        plt.legend()
        # plt.savefig(args.base_path + '/throughput_ema_plot.jpg')
        # plt.savefig(f"plots/{args.base_path.split('/')[-2]}-{args.base_path.split('/')[-1]}.jpg")
        # print(f"{args.base_path.split('/')[-2]}.jpg")
        plt.show()
    else:
        print("No throughput data available for plotting.")
