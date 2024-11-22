import json
import pandas as pd
from matplotlib import pyplot as plt
import argparse
import os

# Function to load JSON files from a given filepath
def load_json(filepath):
    with open(filepath, 'r') as f:
        return json.load(f)

# Set up argument parsing to allow a base path as input
parser = argparse.ArgumentParser(description='Process byte time and latency JSON files.')
parser.add_argument('base_path', type=str, help='Base path to the JSON files')

args = parser.parse_args()

# Construct the full file paths by appending the specific filenames
byte_list = load_json(args.base_path + '/byte_time_list.json')
latency_list = load_json(args.base_path + '/latency.json')

# Print the full paths (just to verify)
print(f'Byte Time File: {args.base_path + "/byte_time_list.json"}')
print(f'Latency File: {args.base_path + "/latency.json"}')

# Convert latency_list to a dictionary for quick lookup by sourceID
latency_dict = {entry['sourceID']: entry for entry in latency_list}

# Calculate throughput with bytecount summed in chunks of 5
throughput_results = []
count = 0
for entry in byte_list:
    id = entry['id']
    
    # Get the corresponding latency entry
    latency_entry = latency_dict.get(id)
    if latency_entry :
        recv_time = int(latency_entry['recv_time'][0])
 
    progress = entry['progress']
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
        
        if latency_entry:
            begin_time = recv_time
        else:
            begin_time = time_start
        # Avoid division by zero
        if time_duration > 0:
            throughput = byte_sum / time_duration
            throughput_results.append({
                "id": id,
                "time": (time_end - begin_time)/1000,  # Use the last time in the chunk for plotting
                "throughput": (throughput)/1000000
            })
        else:
            count += 1


# Convert throughput results to DataFrame
df = pd.DataFrame(throughput_results)

# If 'throughput' exists, calculate Exponential Moving Average (EMA)
if 'throughput' in df.columns:
    df['throughput_ema'] = df['throughput'].ewm(alpha=0.1, adjust=False).mean()

    # Plot throughput EMA over time
    plt.figure()
    plt.plot(df['time'], df['throughput_ema'], color='blue', marker='o', alpha=0.5, label='Throughput EMA')
    plt.xlabel('Time (in seconds)')
    plt.ylabel('Throughput (in Mbps)')
    plt.title({args.base_path.split('/')[-2]})
    plt.legend()
    # plt.savefig(args.base_path + '/throughput_ema_plot.jpg')
    plt.savefig(f"{args.base_path.split('/')[-3]}_{args.base_path.split('/')[-2]}.jpg")
    # print(f"{args.base_path.split('/')[-2]}.jpg")
    # plt.show()
else:
    print("No throughput data available for plotting.")
