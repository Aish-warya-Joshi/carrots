#!/bin/bash

mkdir -p results/comcast
rm -rf results/comcast/*

script_path=~/rabbits-perf/comcast/comcast.js
script_output_path=~/output

download_params=(
    "10000"    #10kb
    "1000000"  #1mb
    "30000000" #30mb
)

timeout_params=(
    "1000"
    "10000"
    "30000"
)

num_flows=(
    "1" "3" "5"
)

rm -rf ${script_output_path}/*

server=16

for timeout in "${timeout_params[@]}"; do
    for param in "${download_params[@]}"; do
        for flow in "${num_flows[@]}"; do
            file_name="comcast/comcast_download_${server}_${param}_${timeout}_${flow}"
            echo "node ${script_path} -download -size ${param} -timeout ${timeout} -server ${server} -flows ${flow}"
            node ${script_path} -download -size ${param} -timeout ${timeout} -server ${server} -flows ${flow}
            mkdir -p results/${file_name}
            rm -rf results/${file_name}/*
            cp -R ${script_output_path} results/${file_name}/
            rm -rf ${script_output_path}/*
        done
    done
done

for timeout in "${timeout_params[@]}"; do
    for param in "${download_params[@]}"; do
        for flow in "${num_flows[@]}"; do
            file_name="comcast/comcast_upload_${server}_${param}_${timeout}_${flow}"
            echo "node ${script_path} -upload -size ${param} -timeout ${timeout} -server ${server} -flows ${flow}"
            node ${script_path} -upload -size ${param} -timeout ${timeout} -server ${server} -flows ${flow}
            mkdir -p results/${file_name}
            rm -rf results/${file_name}/*
            cp -R ${script_output_path} results/${file_name}/
            rm -rf ${script_output_path}/*
        done
    done
done

for test_case in {1..10}; do
    file_name="comcast/comcast_load_${test_case}"
    echo "node ${script_path} -load -server ${server} -test ${test_case}"
    node ${script_path} -load -server ${server}
    mkdir -p results/${file_name}
    rm -rf results/${file_name}/*
    cp -R ${script_output_path} results/${file_name}/
    rm -rf ${script_output_path}/*
done

for test_case in {1..10}; do
    file_name="comcast/comcast_unload_${test_case}"
    echo "node ${script_path} -unload -server ${server} -test ${test_case}"
    node ${script_path} -unload -server ${server}
    mkdir -p results/${file_name}
    rm -rf results/${file_name}/*
    cp -R ${script_output_path} results/${file_name}/
    rm -rf ${script_output_path}/*
done
