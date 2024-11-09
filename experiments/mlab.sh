#!/bin/bash

mkdir -p results/mlab
rm -rf results/mlab/*

script_path=~/rabbits-perf/mlab/mlab.js
script_output_path=~/output

params=(
    # "yyz06" "yyz04" "yyz03" "yyc03" "ywg02" "yvr04" "yvr03" "yvr02" "yul06"
    # "yul03" "yqm02" "wlg02" "tun01" "trn02" "tpe01" "tnr01" "tgd01" "syd05"
    # "syd03" "svg01" "sof02" "sof01" "sin01" "sea10" "sea08" "sea07" "sea04"
    # "sea03" "scl03" "scl01" "prg06" "prg05" "prg04" "prg03" "per02" "per01"
    # "pdx02" "par05" "ord06" "ord03" "ord02" "nuq08" "nuq06" "nuq04" "nuq03"
    # "nbo01" "mty01" "mrs04" "mrs02" "mrs01" "mpm02" "mnl02" "mnl01" "mil07"
    # "mil06" "mil05" "mil04" "mia05" "mia04" "mia03" "mia02" "mex04" "mex03"
    # "mex01" "mad06" "mad04" "mad02" "maa03" "maa02" "maa01" "los02" "lju01"
    # "lis03" "lis02" "lis01" "lim03" "lim02" "lim01" "lhr07" "lhr04" "lga08"
    # "lga06" "lga05" "lga04" "lax06" "lax04" "jnb01" "iad06" "iad04" "iad03"
    # "iad02" "hnl02" "hnl01" "hnd05" "hnd02" "hkg03" "hkg02" "ham02" "gru03"
    # "gru02" "gig04" "gig03" "geg01" "fra06" "fra04" "fra03" "fln01" "eze04"
    # "eze03" "eze02" "eze01" "dub01" "dfw08" "dfw03" "dfw02" "den06" "den05"
    # "den04" "den02" "del04" "del02" "del01" "cpt01" "bru04" "bru02" "bru01"
    # "bom04" "bom02" "bom01" "bog05" "bog04" "bog03" "bog02" "beg01" "bcn01"
    # "atl07" "atl04" "atl03" "atl02" "ath03" "arn06" "arn04" "arn03" "arn02"
    # "ams08" "ams05" "ams04" "akl01"
    "dfw08"
)

streams=(
    "1" "3" "5"
)
per_stream_byte_limit=(
    "100000" "10000000"
)
timeout=(
    "1000"
    "10000"
    "30000"
)

rm -rf ${script_output_path}/*

for site in "${params[@]}"; do

    # ndt7 download test
    file_name="mlab/mlab_download_ndt7_${site}"
    echo "node ${script_path} -download -site ${site}"
    node ${script_path} -download -site ${site}
    mkdir -p results/${file_name}
    rm -rf results/${file_name}/*
    cp -R ${script_output_path} results/${file_name}/
    rm -rf ${script_output_path}/*

    # msak download test
    for stream in "${streams[@]}"; do
        for byte_limit in "${per_stream_byte_limit[@]}"; do
            for time in "${timeout[@]}"; do
                file_name="mlab/mlab_download_msak_${site}_${stream}_${byte_limit}_${time}"
                echo "node ${script_path} -download -site ${site} -msak -streams ${stream} -per_stream_byte_limit ${byte_limit} -duration ${time}"
                node ${script_path} -download -site ${site} -msak -streams ${stream} -per_stream_byte_limit ${byte_limit} -duration ${time}
                mkdir -p results/${file_name}
                rm -rf results/${file_name}/*
                cp -R ${script_output_path} results/${file_name}/
                rm -rf ${script_output_path}/*
            done
        done
    done

    # ndt7 upload test
    file_name="mlab/mlab_upload_ndt7_${site}"
    echo "node ${script_path} -upload -site ${site}"
    node ${script_path} -upload -site ${site}
    mkdir -p results/${file_name}
    rm -rf results/${file_name}/*
    cp -R ${script_output_path} results/${file_name}/
    rm -rf ${script_output_path}/*

    # msak upload test
    object_sizes=(
        "5000"    #5kb
        "500000"  #500kb
        "1000000" #1mb
    )

    for stream in "${streams[@]}"; do
        for byte_limit in "${per_stream_byte_limit[@]}"; do
            for time in "${timeout[@]}"; do
                for size in "${object_sizes[@]}"; do
                    file_name="mlab/mlab_upload_msak_${site}_${stream}_${byte_limit}_${time}_${size}"
                    echo "node ${script_path} -upload -site ${site} -msak -streams ${stream} -per_stream_byte_limit ${byte_limit} -duration ${time} -object_size ${size}"
                    node ${script_path} -upload -site ${site} -msak -streams ${stream} -per_stream_byte_limit ${byte_limit} -duration ${time} -object_size ${size}
                    mkdir -p results/${file_name}
                    rm -rf results/${file_name}/*
                    cp -R ${script_output_path} results/${file_name}/
                    rm -rf ${script_output_path}/*
                done
            done
        done
    done
done
