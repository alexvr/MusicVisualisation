$(document).ready(function () {
    setupMQTT();
    addClickListeners();
    musicVisualisation();
});

var client;
var mqttConnected;
var previousPacket = new Uint8Array(1);
var previousTimeSent = new Date();

function setupMQTT() {
    // Create a client instance
    //client = new Paho.MQTT.Client("192.168.1.127", Number(9001), "JSClient");
    //client = new Paho.MQTT.Client("vanlooverenkoen.be", Number(9001), "JSClient");
    client = new Paho.MQTT.Client("127.0.0.1", Number(9001), "JSClient");

    console.log(client.path);
    console.log(client.host);
    console.log(client.port);

    // set callback handlers
    client.onConnectionLost = onConnectionLost;

    // connect the client
    client.connect({onSuccess: onConnect});
}

function addClickListeners() {
    $("#play-song").click(function () {
        audioElement.play();
    });

    $("#pause-song").click(function () {
        audioElement.pause();
    });

    $("#stop-song").click(function () {
        audioElement.pause();
        audioElement.currentTime = 0;
    });
}

function musicVisualisation() {
    var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    var audioElement = document.getElementById('audioElement');
    var audioSrc = audioCtx.createMediaElementSource(audioElement);
    var analyser = audioCtx.createAnalyser();

    // Set FFT of the song.
    analyser.fftSize = 64;
    // Bind our analyser to the media element source.
    audioSrc.connect(analyser);
    audioSrc.connect(audioCtx.destination);
    var frequencyData = new Uint8Array(32);
    var mqttFrenquencyData = new Uint8Array(32);

    var svgHeight = '300';
    var svgWidth = document.getElementById('graph').offsetWidth;
    var barPadding = '10';

    function createSvg(parent, height, width) {
        return d3.select(parent).append('svg').attr('height', height).attr('width', width);
    }

    var svg = createSvg('#graph', svgHeight, svgWidth);

    // Create our initial D3 chart.
    svg.selectAll('rect')
        .data(frequencyData)
        .enter()
        .append('rect')
        .attr('x', function (d, i) {
            return i * (svgWidth / frequencyData.length);
        })
        .attr('width', svgWidth / frequencyData.length - barPadding);

    // Continuously loop and update chart with frequency data.
    function renderChart() {
        requestAnimationFrame(renderChart);

        // Copy frequency data to frequencyData array.
        analyser.getByteFrequencyData(frequencyData);
        frequencyData = frequencyData.map(function (v) {
            return Math.round((v));
        });

        mqttFrenquencyData = frequencyData.map(function (v) {
            var lvl = Math.round(v / 16);
            if (lvl == 0) {
                return 16;
            } else {
                return --lvl;
            }
        });

        publishMessage(mqttFrenquencyData, new Date());

        // Update d3 chart with new data.
        svg.selectAll('rect')
            .data(frequencyData)
            .attr('y', function (d) {
                return svgHeight - d;
            })
            .attr('height', function (d) {
                return d;
            })
            .attr('fill', function (d) {
                return 'rgb(0, 0, ' + d + ')';
            });
    }

    // Run the loop
    renderChart();
}

function publishMessage(bytearray, currentDate) {
    // Als het vorige pakket korter dan 50 miliseconden geleden is verstuurd, negeer je dit pakket.
    var difference = currentDate.getTime() - previousTimeSent.getTime();

    if (difference > 50) {
        // Checken of het vorige pakket niet dezelfde inhoud heeft dan het vorig verstuurde packet.
        var is_same = bytearray.length == previousPacket.length && bytearray.every(
                function (element, index) {
                    return element === previousPacket[index];
                });

        // Als het pakket niet hetzelfde is, verstuur je het pakket.
        if (!is_same) {
            if (mqttConnected) {
                //client.send("matrixInfo", bytearray, 0, false);

                // QOS is 0 -> fire forget
                client.send("matrixInfo", bytearray, 0, false);
                console.log("packet should be send by now.");
            }
        }

        // Het verstuurde pakket bijhouden ter vergelijking.
        previousPacket = bytearray;
        previousTimeSent = new Date();
    }
}

// called when the client loses its connection
function onConnectionLost(responseObject) {
    console.log("Connection lost");
    if (responseObject.errorCode !== 0) {
        mqttConnected = false;
        console.log("onConnectionLost:" + responseObject.errorMessage);
        client.connect({onSuccess: onConnect});
    }
}

// called when the client connects
function onConnect() {
    // Once a connection has been made, make a subscription and send a message.
    console.log("Connected");
    mqttConnected = true;
}