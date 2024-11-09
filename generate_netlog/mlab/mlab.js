'use strict'
const fs = require('fs');
const puppeteer = require('puppeteer');
const WebSocket = require("ws");
const { program } = require("commander");
const { exit } = require('process');

var tracename = "mlab";

function waitFor(conditionFunction) {
    const poll = resolve => {
        if (conditionFunction()) resolve();
        else setTimeout(_ => poll(resolve), 400);
    }
    return new Promise(poll);
}

program
    .version('0.0.1')
    .option('-download, --download', 'Download speed test')
    .option('-upload, --upload', 'Upload speed test')
    .option('-site, --site [value]', 'specify the site to test')
    .option('-msak, --msak', 'Run using MSAK')
    .option('-streams, --streams [value]', 'specify number of streams when using MSAK (default 2)')
    .option('-cc, --cc [value]', 'specify congestion control algorithm when using MSAK (default bbr)')
    .option('-duration, --duration [value]', 'specify duration of the test when using MSAK (default 10000)')
    .option('-per_stream_byte_limit, --per_stream_byte_limit [value]', 'specify per stream byte limit when using MSAK (default 0)')
    .option('-object_size, --object_size [value]', 'specify object size only for uploads (default 1MB), for download object_size is incremental automatically')
    .parse(process.argv);

var dir = './output';
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}

const option = program.opts();

(
    async () => {
        var tracejson = "./output/" + tracename + ".json";
        var urlsfilename = "./output/" + tracename + "_urls.txt";

        var keyarg = "--ssl-key-log-file=./output/" + tracename + ".key";
        var netlogarg = "--log-net-log=./output/" + tracename + ".netlog";
        console.log("mlab test:" + tracejson);
        const browser = await puppeteer.launch({ headless: 'new', args: [keyarg, netlogarg, '--no-sandbox'] })
        const page = await browser.newPage();

        await page.tracing.start({ path: tracejson, categories: ['devtools.timeline', 'blink.user_timing'] })

        // Navigate to an empty page
        await page.goto('about:blank');
        await page.setRequestInterception(true);

        let urlReceived = false;
        let urlJson = {
            "download": [],
            "upload": [],
            "load": [],
            "unload": []
        };
        let availableServers;

        page.on('request', async (request) => {
            request.continue();
        });

        page.on('response', async (response) => {
            // For ndt7
            if (response.url().includes('locate.measurementlab.net/v2/nearest/ndt/ndt7')) {
                availableServers = (await response.json())['results'];
                urlReceived = true;
            }
            // For msak
            if (response.url().includes('locate.measurementlab.net/v2/nearest/msak/throughput1')) {
                availableServers = (await response.json())['results'];
                urlReceived = true;
            }
        });

        await new Promise((r) => setTimeout(r, 5000));

        const site = option.site ? option.site : 'lax04';
        const url = option.msak ?
            `https://locate.measurementlab.net/v2/nearest/msak/throughput1?site=${site}` :
            `https://locate.measurementlab.net/v2/nearest/ndt/ndt7?site=${site}`;

        await page.evaluate((url) => {
            try {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.send();
                return xhr.responseText;
            } catch (err) {
                console.log(err);
                return err;
            }
        }, url);
        await waitFor(_ => urlReceived === true);

        if (option.msak) {
            let msakDownloadURL = availableServers[0]['urls']['wss:///throughput/v1/download'];
            let msakUploadURL = availableServers[0]['urls']['wss:///throughput/v1/upload'];

            const streams = option.streams ? option.streams : 2;
            const cc = option.cc ? option.cc : 'bbr';
            const duration = option.duration ? option.duration : 10000;
            const per_stream_byte_limit = option.per_stream_byte_limit ? option.per_stream_byte_limit : 0;

            if (option.download) {
                msakDownloadURL = msakDownloadURL.concat(`&streams=${streams}&cc=${cc}&duration=${duration}&bytes=${per_stream_byte_limit}`);
                const waitForDownload = (url) => {
                    return new Promise((resolve) => {
                        const ws = new WebSocket(url, 'net.measurementlab.throughput.v1');
                        ws.onclose = () => {
                            console.log('ws closed');
                            resolve();
                        }
                    });
                };
                await page.evaluate(waitForDownload, msakDownloadURL);
                urlJson.download.push(msakDownloadURL);
            }

            if (option.upload) {
                msakUploadURL = msakUploadURL.concat(`&streams=${streams}&cc=${cc}&duration=${duration}&bytes=${per_stream_byte_limit}`);
                const data_length = option.object_size ? option.object_size : 1048576;
                const waitForUpload = (url, data_length) => {
                    return new Promise((resolve) => {
                        const ws = new WebSocket(url, 'net.measurementlab.throughput.v1');
                        function sendMessages() {
                            const data = new Uint8Array(data_length);
                            ws.send(data);
                            setTimeout(sendMessages, 100);
                        }
                        ws.onopen = () => {
                            sendMessages();
                        }
                        ws.onclose = () => {
                            console.log('ws closed');
                            resolve();
                        }
                    });
                };

                await page.evaluate(waitForUpload, msakUploadURL, data_length);
                urlJson.upload.push(msakUploadURL);
            }
        } else {
            const wsDownloadURL = availableServers[0]['urls']['wss:///ndt/v7/download'];
            const wsUploadURL = availableServers[0]['urls']['wss:///ndt/v7/upload'];

            if (option.download) {
                const waitForDownload = (url) => {
                    return new Promise((resolve) => {
                        const ws = new WebSocket(url, 'net.measurementlab.ndt.v7');
                        ws.onclose = () => {
                            console.log('ws closed');
                            resolve();
                        }
                    });
                };

                await page.evaluate(waitForDownload, wsDownloadURL);
                urlJson.download.push(wsDownloadURL);
            }

            if (option.upload) {
                const data_length = option.object_size ? option.object_size : 1048576;
                const waitForUpload = (url, data_length) => {
                    return new Promise((resolve) => {
                        const ws = new WebSocket(url, 'net.measurementlab.ndt.v7');
                        function sendMessages() {
                            const data = new Uint8Array(data_length);
                            ws.send(data);
                            setTimeout(sendMessages, 100);
                        }
                        ws.onopen = () => {
                            sendMessages();
                        }
                        ws.onclose = () => {
                            console.log('ws closed');
                            resolve();
                        }
                    });
                };

                await page.evaluate(waitForUpload, wsUploadURL, data_length);
                urlJson.upload.push(wsUploadURL);
            }
        }

        await new Promise((r) => setTimeout(r, 400));
        // fs.writeFileSync(urlsfilename, urls.join('\n'));
        const jsonString = JSON.stringify(urlJson);
        fs.writeFileSync(urlsfilename, jsonString);
        await page.tracing.stop();
        await browser.close();
    }
)()
