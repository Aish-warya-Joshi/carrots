#!/bin/bash

city=$1
network=$2

mkdir -p results/ookla_size
rm -rf results/ookla_size/*

script_path=~/rabbits-perf/ookla/ookla.js
script_output_path=~/output

rm -rf ${script_output_path}/*

num_flows=(
    "1" "3" "5"
)

download_params=(
    "10000"    #10kb
    "1000000"  #1mb
    "30000000" #30mb
)

for param in "${download_params[@]}"; do
    for flow in "${num_flows[@]}"; do
        file_name="ookla_size/ookla_download_${city}_${network}_${param}_multi_${flow}"
        echo "node ${script_path} -city \"${city}\" -net \"${network}\" -size \"${param}\" -flows \"${flow}\""
        node ${script_path} -city "${city}" -net "${network}" -size "${param}" -flows "${flow}"
        mkdir -p results/${file_name}
        rm -rf results/${file_name}/*
        cp -R ${script_output_path} results/${file_name}/
        rm -rf ${script_output_path}/*
    done
done

for param in "${download_params[@]}"; do
    for flow in "${num_flows[@]}"; do
        file_name="ookla_size/ookla_upload_${city}_${network}_${param}_multi_${flow}"
        echo "node ${script_path} -city \"${city}\" -net \"${network}\" -size \"${param}\" -upload -flows \"${flow}\""
        node ${script_path} -city "${city}" -net "${network}" -size "${param}" -upload -flows "${flow}"
        mkdir -p results/${file_name}
        rm -rf results/${file_name}/*
        cp -R ${script_output_path} results/${file_name}/
        rm -rf ${script_output_path}/*
    done
done
