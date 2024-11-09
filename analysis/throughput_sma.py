import json
import argparse
import pandas as pd
from matplotlib import pyplot as plt
import pandas.plotting._matplotlib
df = pd.DataFrame()

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
    throughput_map = {}
    window_size = 5
    # Loop through each upload data
    for upload in data:
        id = upload['id']
        progress = upload['progress']

        # Extract time and byte counts for this progress
        byte_counts = pd.Series([progress_obj['bytecount'] for progress_obj in progress])
        times = pd.Series([progress_obj['time'] for progress_obj in progress])

        # Calculate the rolling window for byte counts and times
        byte_window = byte_counts.rolling(window=window_size)
        time_window = times.rolling(window=window_size)
        
        # Calculate time difference in the rolling window and throughput
        time_diff = time_window.max() - time_window.min()
        
        # Calculate throughput: byte sum / time difference
        throughputs = byte_window.sum() / time_diff
        
        # Set throughput to 0 if time_diff is zero or if throughputs contain NaN/inf values
        throughputs = throughputs.apply(lambda x: 0 if pd.isna(x) or x == float('inf') else x).fillna(0)

        # Convert throughputs and times to integer lists for plotting
        throughput_list = throughputs.astype(int).tolist()
        times_list = times.rolling(window_size).max().fillna(0).astype(int).tolist()

        # Slice the lists to remove the first (window_size - 1) entries with NaN
        final_throughputs = throughput_list[window_size - 1:]
        final_times = times_list[window_size - 1:]

        # Prepare DataFrame for plotting
        df = pd.DataFrame({'Throughput': final_throughputs, 'Time': final_times})
        
        # Plotting
        df.plot(kind='scatter', x='Time', y='Throughput')
        plt.xlabel('Time')
        plt.ylabel('Throughput')
        plt.title(f'Throughput vs Time for {id}')
        plt.show()

    return final_list

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

