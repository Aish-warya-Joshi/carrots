'use strict';
const puppeteer = require('puppeteer');
const fs = require('fs');
var tracename = "ookla";
var program = require('commander');
const url = require('url');

/*************************** */

program
    .version('0.0.1')
    .usage('[options] [value ...]')
    .option('-city, --city <string>', 'a string argument')
    .option('-net, --net <string>', 'a string argument')
    .option('-single, --single', 'a boolean argument')
    .option('-upload, --upload', 'a boolean argument')
    .option('-size, --object_size [value]', 'specify object size (default 50000000 for download, 5000000 for upload)')
    .option('-flows, --flows [value]', 'specify number of flows (default 3)')
// .option('-f, --float <f>', 'input a float arg', parseFloat)
// .option('-l, --list <items>', 'a list', list)
// .option('-r, --range <a>..<b>', 'a range', range)

program.on('help', function () {
    console.log('   Examples:')
    console.log('')
    console.log('       # input string, integer and float')
    console.log('       $ ./nodecmd.js -m \"a string\" -i 1 -f 1.01')
    console.log('')
    console.log('       # input range 1 - 3')
    console.log('       $ ./nodecmd.js -r 1..3')
    console.log('')
    console.log('       # input list: [1,2,3]')
    console.log('       $ ./nodecmd.js -l 1,2,3')
    console.log('')
});
program.parse(process.argv)
const options = program.opts();
/*************************** */

function waitFor(conditionFunction) {
    const poll = resolve => {
        if (conditionFunction()) resolve();
        else setTimeout(_ => poll(resolve), 400);
    }
    return new Promise(poll);
}

var dir = './output';
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}

var globaltimeout = 120000;
(
    async () => {
        var tracejson = "./output/" + tracename + ".json";
        var errorfile = "./output/" + tracename + ".err";
        var printscnname = "./output/" + tracename + ".png";
        var printerrname = "./output/" + tracename + ".err.png";
        var urlsfilename = "./output/" + tracename + "_urls.txt";

        var keyarg = "--ssl-key-log-file=./output/" + tracename + ".key";
        var netlogarg = "--log-net-log=./output/" + tracename + ".netlog";
        console.log("ookla test:" + tracejson);
        const browser = await puppeteer.launch({ headless: 'new', args: [keyarg, netlogarg, '--no-sandbox'] })
        const page = await browser.newPage()

        let firstRequestDone = false;
        let resultsGenerated = false;
        await page.setRequestInterception(true);

        let size;
        if (options.object_size) {
            size = options.object_size;
        } else if (options.upload) {
            size = 5000000;
        } else {
            size = 50000000;
        }
        let num_requests = options.flows ? options.flows : 3;

        let latencyURL;
        let curr_nocacheid, downloadParsedURL, uploadParsedURL, modifiedString;
        let testDone = false;

        let urlJson = {
            "download": [],
            "upload": [],
            "load": [],
            "unload": []
        };
        let nocacheid = '@@@@@@@';
        let requestType = 'download?nocache=';
        if (options.upload) requestType = 'upload?nocache=';

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
                    const xhr = new XMLHttpRequest();
                    const data = new Uint8Array(data_length);
                    xhr.open('POST', url, false);
                    xhr.send(data);
                    return xhr.responseText;
                } catch (err) {
                    console.log(err);
                    return err;
                }
            }, uploadURL, size);
        }

        page.on('console', msg => {
            if (msg.text().includes("loadend")) {
                if (!testDone) {
                    if (!options.upload) {
                        modifiedString += '#';

                        downloadParsedURL.query.nocache = modifiedString;
                        let modifiedUrl = url.format({
                            protocol: downloadParsedURL.protocol,
                            host: downloadParsedURL.host,
                            pathname: downloadParsedURL.pathname,
                            query: downloadParsedURL.query,
                        });
                        urlJson.download.push(modifiedUrl);
                        sendDownloadRequest(page, modifiedUrl);
                    }
                }
            }
        });

        page.on('requestfinished', (req) => {
            if (!testDone && req.url().includes('upload?nocache=')) {
                modifiedString += '#';
                uploadParsedURL.query.nocache = modifiedString;

                const modifiedUrl = url.format({
                    protocol: uploadParsedURL.protocol,
                    host: uploadParsedURL.host,
                    pathname: uploadParsedURL.pathname,
                    query: uploadParsedURL.query,
                });
                urlJson.upload.push(modifiedUrl);
                sendUploadRequest(page, modifiedUrl, size);
            }
        })

        page.on('request', async (request) => {
            const parsedUrl = url.parse(request.url(), true);
            if (options.upload && request.url().includes(nocacheid)) {
                // This is only meant for upload requests
                // as first upload request is a preflight request
                const headers = request.headers();
                headers["Accept"] = '*/*';
                headers["Access-Control-Request-Headers"] = 'content-type';
                headers["Access-Control-Request-Method"] = 'POST';
                headers["Content-Type"] = 'application/octet-stream';
                headers["Content-Length"] = size;
                headers["Referer"] = 'https://www.speedtest.net/';
                headers["Origin"] = 'https://www.speedtest.net';
                headers["Host"] = 'speedtest.race.com:8080';
                headers["User-Agent"] = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/121.0.0.0 Safari/537.36';
                request.continue({ headers });
            }
            else if ((options.upload && request.url().includes('download?nocache='))
                || (!options.upload && request.url().includes('upload?nocache='))) {
                // skip download requests if upload is enabled
                // skip upload requests if upload is disabled
                request.abort();
            } else if (!firstRequestDone && request.url().includes(requestType)) {
                // Allow the first request
                firstRequestDone = true;

                if (options.upload) {
                    // Handle the first upload request
                    nocacheid = parsedUrl.query.nocache;
                    // urlJson.upload.push(request.url());
                    // request.continue();
                    request.abort();

                    // send additional upload requests with different nocacheid
                    modifiedString = nocacheid;
                    uploadParsedURL = parsedUrl;

                    Array.from({ length : num_requests}, () => {
                        modifiedString += '#'
                        parsedUrl.query.nocache = modifiedString;
                        const modifiedUrl = url.format({
                            protocol: parsedUrl.protocol,
                            host: parsedUrl.host,
                            pathname: parsedUrl.pathname,
                            query: parsedUrl.query,
                        });

                        urlJson.upload.push(modifiedUrl);
                        sendUploadRequest(page, modifiedUrl, size);
                    }, num_requests);

                    if (latencyURL) {
                        let curr_nocacheid = latencyURL.query.nocache;
                        let modifiedString = curr_nocacheid;

                        let cnt = 10;
                        while (cnt--) {
                            const copiedString = modifiedString;
                            const tempString = copiedString.substring(0, copiedString.length - cnt - 1) + '#' + copiedString.substring(copiedString.length - cnt - 1);
                            latencyURL.query.nocache = tempString;
                            const modifiedUrl = url.format({
                                protocol: latencyURL.protocol,
                                host: latencyURL.host,
                                pathname: latencyURL.pathname,
                                query: latencyURL.query,
                            });

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
                            }, modifiedUrl);
                            await new Promise(resolve => setTimeout(resolve, 250));
                        }
                    }
                } else {
                    // Handle the first download request
                    parsedUrl.query.size = size.toString();

                    // let modifiedUrl = url.format({
                    //     protocol: parsedUrl.protocol,
                    //     host: parsedUrl.host,
                    //     pathname: parsedUrl.pathname,
                    //     query: parsedUrl.query,
                    // });
                    // urlJson.download.push(modifiedUrl);
                    // request.continue({ url: modifiedUrl });
                    request.abort();

                    curr_nocacheid = parsedUrl.query.nocache;
                    modifiedString = curr_nocacheid;
                    downloadParsedURL = parsedUrl;
                    while (num_requests--) {
                        modifiedString += '#';

                        parsedUrl.query.nocache = modifiedString;
                        let modifiedUrl = url.format({
                            protocol: parsedUrl.protocol,
                            host: parsedUrl.host,
                            pathname: parsedUrl.pathname,
                            query: parsedUrl.query,
                        });
                        urlJson.download.push(modifiedUrl);
                        sendDownloadRequest(page, modifiedUrl);
                    }

                    if (latencyURL) {
                        let curr_nocacheid = latencyURL.query.nocache;
                        let modifiedString = curr_nocacheid;

                        let cnt = 10;
                        while (cnt--) {
                            const copiedString = modifiedString;
                            const tempString = copiedString.substring(0, copiedString.length - cnt - 1) + '#' + copiedString.substring(copiedString.length - cnt - 1);
                            latencyURL.query.nocache = tempString;
                            const modifiedUrl = url.format({
                                protocol: latencyURL.protocol,
                                host: latencyURL.host,
                                pathname: latencyURL.pathname,
                                query: latencyURL.query,
                            });

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
                            }, modifiedUrl);
                            await new Promise(resolve => setTimeout(resolve, 250));
                        }
                    }
                }
            } else if (parsedUrl.query.nocache && parsedUrl.query.nocache.includes('#')) {
                if (request.url().includes('hello?nocache')) {
                    urlJson.load.push(request.url());
                }
                request.continue();
            } else {
                if (!firstRequestDone || (!request.url().includes(requestType))) {
                    let isLatencyRequest = request.url().includes('hello?nocache')
                    if (isLatencyRequest) {
                        latencyURL = parsedUrl;
                    }
                    request.continue();
                } else {
                    request.abort();
                }
            }
        });

        page.on('response', async (response) => {
            // Check if the results are generated
            if (response.url().includes('https://www.speedtest.net/api/results.php')) {
                resultsGenerated = true;
            }
        });

        await page.setViewport({ width: 1240, height: 1024 })

        await page.tracing.start({ path: tracejson, categories: ['devtools.timeline', 'blink.user_timing'] })

        page.goto('https://www.speedtest.net', { waitUntil: 'domcontentloaded' })
            .catch((err) => {
                fs.writeFileSync(errorfile, "Error goto");
                fs.writeFileSync(errorfile, err);
                page.screenshot({ path: printerrname })
            });


        if (options.city && options.net) {
            var cityname = options.city.replace(/_/g, ' ');
            // cityname.replace("_"," ");
            var netname = options.net.replace(/_/g, ' ');
            // netname.replace("_"," ");

            if (options.single) {
                await page.waitForSelector('div.test-modes-wrapper > div.toggle > a.test-mode-icon > svg:nth-child(1) > use')
                    .catch((err) => {
                        fs.writeFileSync(errorfile, "Error change connection not found");
                        fs.writeFileSync(errorfile, err);
                        page.screenshot({ path: printerrname })
                    });

                await page.click('div.test-modes-wrapper > div.toggle > a.test-mode-icon > svg:nth-child(1) > use')
                    .catch((err) => {
                        fs.writeFileSync(errorfile, "Error change connection not found");
                        fs.writeFileSync(errorfile, err);
                        page.screenshot({ path: printerrname })
                    });
            }

            await page.waitForSelector('div.pure-u-5-12:nth-child(3) > div:nth-child(1) > div:nth-child(1) > div:nth-child(4) > a:nth-child(1)')
                .catch((err) => {
                    fs.writeFileSync(errorfile, "Error change server option not found");
                    fs.writeFileSync(errorfile, err);
                    page.screenshot({ path: printerrname })
                });

            await page.click('div.pure-u-5-12:nth-child(3) > div:nth-child(1) > div:nth-child(1) > div:nth-child(4) > a:nth-child(1)')
                .catch((err) => {
                    fs.writeFileSync(errorfile, "Error change server");
                    fs.writeFileSync(errorfile, err);
                    page.screenshot({ path: printerrname })
                });

            await page.waitForSelector('#host-search')
                .catch((err) => {
                    console.log(err);
                    fs.writeFileSync(errorfile, "Wait input");
                    fs.writeFileSync(errorfile, err);
                    page.screenshot({ path: printerrname })
                });

            await page.type('#host-search', cityname);
            await page.waitForTimeout(2000);

            const datatext = await page.$eval('.server-hosts-list', el => el.innerText);
            const datalist = datatext.split(/[\r\n]/);
            var count = 0;
            var match = false;
            for (var data of datalist) {
                count++;
                if (data.toUpperCase().indexOf(netname.toUpperCase()) != -1) {
                    console.log("match,server name=" + data);
                    match = true;
                    break;
                }
            }
            if (match) {
                // .server-hosts-list > ul:nth-child(2) > li:nth-child(3) > a:nth-child(1)
                var selector1 = ".server-hosts-list > ul:nth-child(2) > li:nth-child(" + count + ")";
                await page.click(selector1)
                    .catch((err) => {
                        fs.writeFileSync(errorfile, "Error start");
                        fs.writeFileSync(errorfile, err);
                        page.screenshot({ path: printerrname })
                    });
            } else {
                console.log("No such a server");
                await page.tracing.stop()
                await browser.close();
            }
        }

        await page.click('span.start-text')
            .catch((err) => {
                fs.writeFileSync(errorfile, "Error start");
                fs.writeFileSync(errorfile, err);
                page.screenshot({ path: printerrname })
            });

        await waitFor(_ => resultsGenerated === true);
        testDone = true;
        console.log('Results generated');

        await page.screenshot({ path: printscnname });

        // const speedvalue = await page.$eval('.download-speed', el => el.innerText)
        //     .catch((err) => {
        //         fs.writeFileSync(errorfile, "Error speedvalue");
        //         fs.writeFileSync(errorfile, err);
        //     });
        // const ulspeedvalue = await page.$eval('.upload-speed', el => el.innerText)
        //     .catch((err) => {
        //         fs.writeFileSync(errorfile, "Error ulspeedvalue");
        //         fs.writeFileSync(errorfile, err);
        //     });
        // const ulatency = await page.$eval('.ping-speed', el => el.innerText)
        //     .catch((err) => {
        //         fs.writeFileSync(errorfile, "Error ulatency");
        //         fs.writeFileSync(errorfile, err);
        //     });

        // if (options.upload) {
        //     const uplatency = await page.$eval('.result-item-latencyup', el => el.innerText)
        //         .catch((err) => {
        //             fs.writeFileSync(errorfile, "Error uplatency");
        //             fs.writeFileSync(errorfile, err);
        //         });

        //     console.log('Upload latency:' + uplatency);
        // } else {
        //     const downlatency = await page.$eval('.result-item-latencydown', el => el.innerText)
        //         .catch((err) => {
        //             fs.writeFileSync(errorfile, "Error downlatency");
        //             fs.writeFileSync(errorfile, err);
        //         });

        //     console.log('Download latency:' + downlatency);
        // }

        // const serverisp = await page.$eval('.hostUrl', el => el.innerText)
        //     .catch((err) => {
        //         fs.writeFileSync(errorfile, "Error serverisp");
        //         fs.writeFileSync(errorfile, err);
        //     });
        // const serverloc = await page.$eval('.result-data .name', el => el.innerText)
        //     .catch((err) => {
        //         fs.writeFileSync(errorfile, "Error serverloc");
        //         fs.writeFileSync(errorfile, err);
        //     });

        // let resultstring = speedvalue + ";" + ulspeedvalue + ";" + ulatency + ";" + serverloc + ";" + serverisp;
        // console.log(resultstring);
        // fs.writeFileSync("./output/" + tracename + ".web.csv", resultstring);

        const jsonString = JSON.stringify(urlJson);
        fs.writeFileSync(urlsfilename, jsonString);
        // await new Promise(r => setTimeout(r, 2500000));
        await page.tracing.stop()
        await browser.close();
    }
)()