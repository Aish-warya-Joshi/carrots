#!/bin/bash

params=(
    "washington ette"
    "seattle nitel"
    "seattle centurylink"
    "new_york spectrum"
    "san_diego cox"
    "los_angeles frontier"
)

mkdir -p results/ookla
rm -rf results/ookla/*

script_path=~/rabbits-perf/ookla/ookla.js
script_output_path=~/output

rm -rf ${script_output_path}/*

for param in "${params[@]}"; do
    set -- $param
    city=$1
    network=$2

    file_name="ookla/ookla_download_${city}_${network}_multi"
    echo "node ${script_path} -city \"${city}\" -net \"${network}\""
    node ${script_path} -city "${city}" -net "${network}"
    mkdir -p results/${file_name}
    rm -rf results/${file_name}/*
    cp -R ${script_output_path} results/${file_name}/
    rm -rf ${script_output_path}/*

    file_name="ookla/ookla_download_${city}_${network}_single"
    echo "node ${script_path} -city \"${city}\" -net \"${network}\" -single"
    node ${script_path} -city "${city}" -net "${network}" -single
    mkdir -p results/${file_name}
    rm -rf results/${file_name}/*
    cp -R ${script_output_path} results/${file_name}/
    rm -rf ${script_output_path}/*

    file_name="ookla/ookla_upload_${city}_${network}_multi"
    echo "node ${script_path} -city \"${city}\" -net \"${network}\" -upload"
    node ${script_path} -city "${city}" -net "${network}" -upload
    mkdir -p results/${file_name}
    rm -rf results/${file_name}/*
    cp -R ${script_output_path} results/${file_name}/
    rm -rf ${script_output_path}/*

    file_name="ookla/ookla_upload_${city}_${network}_single"
    echo "node ${script_path} -city \"${city}\" -net \"${network}\" -upload -single"
    node ${script_path} -city "${city}" -net "${network}" -upload -single
    mkdir -p results/${file_name}
    rm -rf results/${file_name}/*
    cp -R ${script_output_path} results/${file_name}/
    rm -rf ${script_output_path}/*
done
