'use strict'
const puppeteer = require('puppeteer');
const fs = require('fs');
var program = require('commander');

var tracename = "cloudflare";

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
    .option('-size, --object_size [value]', 'specify object size')
    .option('-timeout, --timeout [value]', 'specify timeout (default 10000)', 10000)
    .option('-flows, --flows [value]', 'specify number of flows (default 3)', 3)
    .parse(process.argv);

const option = program.opts();

var dir = './output';
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}

(
    async () => {
        var tracejson = "./output/" + tracename + ".json";
        var urlsfilename = "./output/" + tracename + "_urls.txt";

        var keyarg = "--ssl-key-log-file=./output/" + tracename + ".key";
        var netlogarg = "--log-net-log=./output/" + tracename + ".netlog";
        console.log("cloudflare test:" + tracejson);
        const browser = await puppeteer.launch({ headless: 'new', args: [keyarg, netlogarg, '--no-sandbox'] })
        const page = await browser.newPage();

        await page.tracing.start({ path: tracejson, categories: ['devtools.timeline', 'blink.user_timing'] })

        // Navigate to an empty page
        await page.goto('about:blank');
        await page.setRequestInterception(true);

        const timeout = option.timeout;
        let city = '', colo = '';

        let size;
        if (option.object_size) {
            size = option.object_size;
        } else if (option.download) {
            size = 10485760; // 10MB default size for download
        } else {
            size = 1048576; // 1MB default size for upload
        }
        const num_requests = option.flows;

        let urlJson = {
            "download": [],
            "upload": [],
            "load": [],
            "unload": []
        };
        const measId = 6172828167751077;
        const downloadURL = `https://speed.cloudflare.com/__down?measId=${measId}&bytes=${size}`;
        const uploadURL = `https://speed.cloudflare.com/__up?measId=${measId}`
        const unloadLatencyURL = `https://speed.cloudflare.com/__down?measId=${measId}&bytes=0`;
        const loadedLatencyURLWhileDownload = 'https://speed.cloudflare.com/__down?during=download&bytes=0';
        // const loadedLatencyURLWhileUpload = 'https://speed.cloudflare.com/__down?during=upload&bytes=0';

        page.on('request', async (request) => {
            request.continue();
        });

        page.on('response', async (response) => {
            if (response.url().includes(downloadURL)) {
                const headers = response.headers();
                if (city === '') city = headers['cf-meta-city'];
                if (colo === '') colo = headers['cf-meta-colo'];
            }
            // console.log(response.url());
        });

        var testDone = false;
        const sendDownloadRequest = (page, downloadURL) => {
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
            }, downloadURL);
        }

        const sendUploadRequest = (page, uploadURL, size) => {
            page.evaluate((url, data_length) => {
                try {
                    const data = new Uint8Array(data_length);
                    const xhr = new XMLHttpRequest();

                    xhr.open('POST', url, true);
                    xhr.setRequestHeader('Accept', '*/*');
                    xhr.setRequestHeader('Accept-Encoding', 'gzip, deflate, br, zstd');
                    xhr.setRequestHeader('Content-Type', 'text/plain;charset=UTF-8');
                    xhr.setRequestHeader('Content-Length', data.length);
                    xhr.setRequestHeader('Host', 'speed.cloudflare.com');
                    // xhr.setRequestHeader('Origin', 'https://speed.cloudflare.com');
                    xhr.setRequestHeader('Referer', 'https://speed.cloudflare.com/');
                    xhr.send(data);
                    data = null;
                    return xhr.responseText;
                } catch (err) {
                    console.log(err);
                    return err;
                }
            }, uploadURL, size);
        }

        page.on('console', msg => {
            if (msg.text().includes("loadend")) {
                console.log(msg.text());
                if (!testDone) {
                    if (option.download) {
                        urlJson.download.push(downloadURL);
                        sendDownloadRequest(page, downloadURL)
                    }
                }
            }
        });

        await new Promise(r => setTimeout(r, 5000));

        if (option.download) {
            // start download test
            Array.from({ length: num_requests }, () => {
                urlJson.download.push(downloadURL);
                sendDownloadRequest(page, downloadURL);
            }, num_requests);

            await new Promise(r => setTimeout(r, timeout));
            testDone = true;
            await waitFor(_ => city !== '' && colo !== '');
            console.log(`City: ${city}; Colo: ${colo}`);
        }

        page.on('requestfinished', (req) => {
            if (!testDone && req.url().includes(uploadURL)) {
                urlJson.upload.push(uploadURL);
                sendUploadRequest(page, uploadURL, size);
            }
        })

        if (option.upload) {
            // start upload test
            Array.from({ length: num_requests }, () => {
                urlJson.upload.push(uploadURL);
                sendUploadRequest(page, uploadURL, size);
            }, num_requests);
            await new Promise(r => setTimeout(r, timeout));
            testDone = true;
        }

        if (option.unload) {
            // start unloaded latency test
            let start = performance.now();
            while (performance.now() - start < timeout) {
                await new Promise(r => setTimeout(r, 200));
                urlJson.unload.push(unloadLatencyURL);
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
                }, unloadLatencyURL);
            }
        }

        if (option.load) {
            // start loaded latency test
            // first start a download request to load the server
            const latencyDownloadURL = `https://speed.cloudflare.com/__down?measId=${measId}&bytes=${size * 150}`;
            Array.from({ length: 4 }, () => {
                urlJson.download.push(latencyDownloadURL);
                return page.evaluate((url) => {
                    try {
                        const xhr = new XMLHttpRequest();
                        xhr.open('GET', url, true);
                        xhr.send();
                        return xhr.responseText;
                    } catch (err) {
                        console.log(err);
                        return err;
                    }
                }, latencyDownloadURL);
            }, num_requests);

            // then start the loaded latency test
            let start = performance.now();
            while (performance.now() - start < 6000) {
                await new Promise(r => setTimeout(r, 400));
                urlJson.load.push(loadedLatencyURLWhileDownload);
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
                }, loadedLatencyURLWhileDownload);
            }
        }

        console.log("test done")
        await new Promise(r => setTimeout(r, 400));
        // fs.writeFileSync(urlsfilename, urls.join('\n'));
        const jsonString = JSON.stringify(urlJson);
        fs.writeFileSync(urlsfilename, jsonString);
        await page.tracing.stop();
        await browser.close();
    }
)()
