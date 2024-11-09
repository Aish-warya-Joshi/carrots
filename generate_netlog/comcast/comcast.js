'use strict'
const puppeteer = require('puppeteer');
const readline = require('readline');
const fs = require('fs')
var program = require('commander');

var tracename = "comcast";

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
    .option('-load, --load', 'Loaded latency test')
    .option('-unload, --unload', 'Unloaded latency test')
    .option('-server, --server [value]', 'specify the server to test')
    .option('-size, --object_size [value]', 'specify object size (default 200000000 for download, 5000000 for upload)')
    .option('-timeout, --timeout [value]', 'specify timeout (default 10000)', 10000)
    .option('-flows, --flows [value]', 'specify number of flows (default 4)', 4)
    .parse(process.argv);

function getRandomNumber() {
    const max = 9999999999999999;
    const seed = new Date().getTime();
    const randomValue = Math.floor(Math.random() * (max + 1));
    const seededRandom = (randomValue + seed) % (max + 1) + 1;
    return seededRandom;
}

const option = program.opts();

var dir = './output';
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}

(
    async () => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        var tracejson = "./output/" + tracename + ".json";
        var urlsfilename = "./output/" + tracename + "_urls.txt";

        var keyarg = "--ssl-key-log-file=./output/" + tracename + ".key";
        var netlogarg = "--log-net-log=./output/" + tracename + ".netlog";
        console.log("comcast test:" + tracejson);
        const browser = await puppeteer.launch({
            headless: 'new',
            args: [
                keyarg,
                netlogarg,
                '-no-sandbox',
                '--disable-web-security'
            ]
        })
        const page = await browser.newPage();

        await page.tracing.start({ path: tracejson, categories: ['devtools.timeline', 'blink.user_timing'] })

        // Navigate to an empty page
        await page.goto('about:blank');
        await page.setRequestInterception(true);

        let size;
        if (option.object_size) {
            size = option.object_size;
        } else if (option.download) {
            size = 200000000;
        } else {
            size = 5000000;
        }
        const num_requests = option.flows ? option.flows : 4;

        let urlJson = {
            "download": [],
            "upload": [],
            "load": [],
            "unload": []
        };
        const timeout = option.timeout;

        page.on('request', async (request) => {
            request.continue();
        });

        let hostFound = false;
        let testURLFound = false;
        let available_hosts = [];
        let serverInfoResponse;
        page.on('response', async (response) => {
            if (response.url().includes('testplans')) {
                const data = await response.json();
                for (let i = 0; i < data['serverLocation'].length; i++) {
                    available_hosts.push(data['serverLocation'][i]);
                }
                hostFound = true;
            }
            if (response.url().includes('selectservers')) {
                const data = await response.json();
                serverInfoResponse = data;
                testURLFound = true;
            }
        });

        var testDone = false;
        const sendDownloadRequest = (page, url) => {
            page.evaluate((url) => {
                try {
                    const xhr = new XMLHttpRequest();
                    function handleLoadEnd(event) {
                        console.log('XMLHttpRequest loadend event:', event);
                        console.log('Response text:', xhr.responseText);
                    }

                    xhr.addEventListener('loadend', handleLoadEnd);
                    xhr.open('GET', url, true);
                    xhr.send();
                    return xhr.responseText;
                } catch (err) {
                    console.log(err);
                    return err;
                }
            }, url);
        }

        const sendUploadRequest = (page, url, size) => {
            page.evaluate((url, data_length) => {
                try {
                    const data = new Uint8Array(data_length);
                    const xhr = new XMLHttpRequest();

                    xhr.upload.addEventListener('loadend', event => {
                        console.log('Upload loadend event:', event);
                    });

                    xhr.upload.addEventListener('progress', event => {
                        console.log(`Upload progress: ${event.loaded} of ${event.total} bytes uploaded`);
                    });
                    xhr.open('POST', url, true);
                    xhr.setRequestHeader('Accept', '*/*');
                    xhr.setRequestHeader('Accept-Encoding', 'gzip, deflate, br, zstd');
                    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
                    xhr.setRequestHeader('Content-Length', data_length);
                    xhr.setRequestHeader('Host', 'v6-qoe-lrck-03.speedtest-web.sys.comcast.net:6020');
                    xhr.setRequestHeader('Origin', 'https://speedtest.xfinity.com');
                    xhr.setRequestHeader('Referer', 'https://speedtest.xfinity.com/');
                    xhr.setRequestHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
                    xhr.setRequestHeader('Sec-Fetch-Dest', 'empty');
                    xhr.setRequestHeader('Sec-Fetch-Mode', 'cors');
                    xhr.setRequestHeader('Sec-Fetch-Site', 'cross-site');
                    xhr.send(data);
                    return xhr.responseText;
                } catch (err) {
                    console.log(err);
                    return err;
                }
            }, url, size);
        }

        page.on('console', msg => {
            if (msg.text().includes("loadend")) {
                console.log(msg.text());
                if (!testDone) {
                    if (option.download) {
                        let requestURL = `https://${baseURL}:6020/api/downloads?bufferSize=${size}&r=0.${getRandomNumber()}`
                        urlJson.download.push(requestURL);
                        sendDownloadRequest(page, requestURL);
                    }
                    else if (option.upload) {
                        let requestURL = `https://${baseURL}:6020/api/uploads?r=0.${getRandomNumber()}`
                        urlJson.upload.push(requestURL);
                        sendUploadRequest(page, requestURL, size);
                    }
                }
            }
            if (msg.text().includes("progress")) {
                console.log(msg.text())
            }
        });

        await new Promise(r => setTimeout(r, 5000));

        const hostURL = 'https://speedtestprod.mw.comcast.net/api/testplans';
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
        }, hostURL);

        await waitFor(_ => hostFound === true);
        console.log("Host found");
        console.log("Select an option:");
        available_hosts.forEach((option, index) => {
            console.log(`${index + 1}. ${option}`);
        });

        // let choice = await new Promise((resolve) => {
        //     rl.question('Enter your choice: ', (answer) => resolve(answer));
        // });
        let choice = 1;
        if (option.server) {
            choice = option.server;
        }
        console.log(available_hosts[choice - 1]);

        const testURL = `https://speedtestprod.mw.comcast.net/api/selectservers/${available_hosts[choice - 1]}`;
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
        }, testURL);
        await waitFor(_ => testURLFound === true);

        const serverID = serverInfoResponse[0]['Fqdn'];
        let insertionString = "speedtest-web.";
        let dotIndex = serverID.indexOf('.');
        let baseURL = serverID.slice(0, dotIndex + 1) + insertionString + serverID.slice(dotIndex + 1);
        console.log(baseURL);

        if (option.download) {
            const generateDownloadURL = () => `https://${baseURL}:6020/api/downloads?bufferSize=${size}&r=0.${getRandomNumber()}`;
            let downloadURLs = Array.from({ length: num_requests }, () => generateDownloadURL());
            downloadURLs.forEach(url => {
                urlJson.download.push(url);
                sendDownloadRequest(page, url);
            });
            await new Promise(r => setTimeout(r, timeout));
            testDone = true;
        }

        if (option.upload) {
            const generateUploadURL = () => `https://${baseURL}:6020/api/uploads?r=0.${getRandomNumber()}`;
            let uploadURLs = Array.from({ length: num_requests }, () => generateUploadURL());
            uploadURLs.forEach(url => {
                urlJson.upload.push(url);
                sendUploadRequest(page, url, size);
            });
            await new Promise(r => setTimeout(r, timeout));
            testDone = true;
        }

        if (option.unload) {
            let unloadURL;
            let start = performance.now();
            while (performance.now() - start < timeout) {
                unloadURL = `https://${baseURL}/api/latencys?0.${getRandomNumber()}`;
                await new Promise(r => setTimeout(r, 200));
                urlJson.unload.push(unloadURL);
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
                }, unloadURL);
            }
        }

        if (option.load) {
            // start loaded latency test
            // first start a download request to load the server
            const generateDownloadURL = () => `https://${baseURL}:6020/api/downloads?bufferSize=200000000&r=0.${getRandomNumber()}`;
            let downloadURLs = Array.from({ length: 4 }, () => generateDownloadURL());
            downloadURLs.forEach(url => {
                urlJson.download.push(url);
                page.evaluate((url) => {
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
            });

            // then start the loaded latency test
            let loadURL;
            let start = performance.now();
            while (performance.now() - start < timeout) {
                loadURL = `https://${baseURL}/api/latencys?0.${getRandomNumber()}`;
                await new Promise(r => setTimeout(r, 200));
                urlJson.load.push(loadURL);
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
                }, loadURL);
            }
        }

        console.log("Test done")
        await new Promise(r => setTimeout(r, 400));
        // fs.writeFileSync(urlsfilename, urls.join('\n'));
        const jsonString = JSON.stringify(urlJson);
        fs.writeFileSync(urlsfilename, jsonString);
        rl.close();
        await page.tracing.stop();
        await browser.close();
    }
)()