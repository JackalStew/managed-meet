import { generateKey, generatePassword } from "./random.js"
import { bytesToBase64, base64ToBytes } from "./base64.js"
import { hangupAndDispose, encryptAndHandleMsg, decryptAndHandleMsg, configToHash } from "./meet-common.js"

function inElectronRenderer() {
    if ((window && window.process && window.process.type) == "renderer") return true;
    else return false;
}

/* If we hit an error, try to hangup the reload after a bit */
function defaultError(err) {
    console.log("Caught error", err);
    hangupAndDispose(gJitsiApi);
    setTimeout(() => {location.reload()}, 5000);
}

/* Set the width of the sidebar to 250px and the left margin of the page content to 250px */
function openSidebar() {
    document.getElementById("sidebar").style.width = "25%";
    var jitsiIFrame = gJitsiApi.getIFrame();
    jitsiIFrame.style.marginLeft = "25%";
    jitsiIFrame.style.width = "75%";

    if (gConfigOptions.showConfig) {
        document.getElementById("controlInfo").style.display = "block";
    } else {
        document.getElementById("controlInfo").style.display = "none";
    }
}
  
/* Set the width of the sidebar to 0 and the left margin of the page content to 0 */
function closeSidebar() {
    document.getElementById("sidebar").style.width = "0";
    var jitsiIFrame = gJitsiApi.getIFrame();
    jitsiIFrame.style.marginLeft = "0";
    jitsiIFrame.style.width = "100%";
}

function onPartitipantsChange() {
    if (gJitsiApi.getNumberOfParticipants() > 1) {
        closeSidebar();
    } else {
        if (gConfigOptions.showSidebar) {
            openSidebar();
        } else {
            closeSidebar();
        }
    }
}

function updateMuteStatus() {
    gJitsiApi.isVideoMuted().then(muted => {
        if (muted != gConfigOptions.localMute) {
            gJitsiApi.executeCommand('toggleVideo');
        }
    });
    gJitsiApi.isAudioMuted().then(muted => {
        if (muted != gConfigOptions.localMute) {
            gJitsiApi.executeCommand('toggleAudio');
        }
    });
}

function generateConfig() {
    var thisConfig = {
        displayName: "TestDN",
        roomName: generatePassword(4),
        roomPass: generatePassword(4),
        controlKey: bytesToBase64(generateKey(16)),
        autoHdmi: true,
        showSidebar: true,
        showConfig: true,
        localMute: false
    }
    return thisConfig;
}

function getStoredConfig() {
    // start with a blank slate
    var thisConfig = generateConfig();
    var tempConfig = {};

    if (localStorage.getItem("config") !== null) {
        // Try to read from local storage to populate it
        try {
            tempConfig = JSON.parse(localStorage.config);
            for (var key in thisConfig) {
                if (key in tempConfig) {
                    thisConfig[key] = tempConfig[key]
                }
            }
        } catch {};
    }
    gConfigOptions = thisConfig;
}

function saveConfig() {
    localStorage.setItem("config", JSON.stringify(gConfigOptions));
}

function clearConfig() {
    localStorage.clear();
}

function applyNewConfig(configIn) {
    let newPassFlag = false;
    let reloadFlag = false;

    const oldKey = base64ToBytes(gConfigOptions.controlKey);

    for (var key in configIn) {
        if (key in gConfigOptions && gConfigOptions[key] != configIn[key]) {
            switch(key) {
                case "roomPass":
                    newPassFlag = true;
                    break
                case "roomName":
                    reloadFlag = true;
                    break;
                default:
                    break
            }
            gConfigOptions[key] = configIn[key]
        }
    }

    // New config parsed just fine, time for an update!
    // First, sort out password if it changed
    if (newPassFlag) {
        console.log("Updating password");
        gJitsiApi.executeCommand('password', gConfigOptions.roomPass);
    }

    // Save new config locally
    saveConfig();

    // May need a reload
    if (reloadFlag) {
        console.log("Reloading due to config update...");
        hangupAndDispose(gJitsiApi);
        location.reload();
    } else {
        // Otherwise run these functions to update display
        onPartitipantsChange();
        updateMuteStatus();
    }
}

function sendMsg(msgOut) {
    gJitsiApi.executeCommand('sendEndpointTextMessage', '', msgOut);
}

function msgHandler(msgObj) {
    switch (msgObj.type) {
        case "getConfig":
            console.log("Config information requested")
            encryptAndHandleMsg({
                type: "config",
                config: gConfigOptions
            }, base64ToBytes(gConfigOptions.controlKey), sendMsg);
            break;

        case "setConfig":
            console.log("New config information received")
            console.log(msgObj.config);
            applyNewConfig(msgObj.config)
            console.log("New config information set")
            break;
    }
}

try {
    var gConfigOptions = null;

    getStoredConfig();
    saveConfig();

    var domain = "meet.jit.si";
    var joinUrl = "https://" + domain + '/' + gConfigOptions["roomName"];
    var controlUrl = "https://jackalstew.github.io/managed-meet/control.html#" + configToHash(gConfigOptions)

    document.getElementById("roomUrl").href = joinUrl;
    document.getElementById("roomUrl").innerHTML = joinUrl;

    document.getElementById("roomPass").innerHTML = gConfigOptions["roomPass"];

    document.getElementById("controlUrl").href = controlUrl;

    const qrSize = 256;

    var joinQR = new QRCode(document.getElementById("joinQR"), {
        text: joinUrl,
        width: qrSize,
        height: qrSize,
        colorDark: window.getComputedStyle(document.getElementById("joinInfo")).color,
        colorLight: window.getComputedStyle(document.getElementById("joinInfo")).backgroundColor,
        correctLevel: QRCode.CorrectLevel.L
    });

    var controlQR = new QRCode(document.getElementById("controlQR"), {
        text: controlUrl,
        width: qrSize,
        height: qrSize,
        colorDark: window.getComputedStyle(document.getElementById("controlInfo")).color,
        colorLight: window.getComputedStyle(document.getElementById("controlInfo")).backgroundColor,
        correctLevel: QRCode.CorrectLevel.L
    }); 

    var options = {
        roomName: gConfigOptions.roomName,
        width: "100%",
        height: "100%",
        parentNode: undefined,
        userInfo: {
            displayName: gConfigOptions.displayName
        },
        configOverwrite: {
            prejoinPageEnabled: false,
            notifications: [],
            startWithAudioMuted: gConfigOptions.localMute,
            startWithVideoMuted: gConfigOptions.localMute
        },
        interfaceConfigOverwrite: {},
    }
    var gJitsiApi = new JitsiMeetExternalAPI(domain, options);

    if (gConfigOptions.showSidebar) {
        openSidebar();
    }

    // when local user is trying to enter in a locked room
    gJitsiApi.addEventListener('passwordRequired', () => {
        try {
            gJitsiApi.executeCommand('password', gConfigOptions.roomPass);
        } catch(err) {
            defaultError(err);
        };
    });

    // when local user has joined the video conference 
    gJitsiApi.addEventListener('videoConferenceJoined', (response) => {
        try {
            gJitsiApi.executeCommand('password', gConfigOptions.roomPass);
        } catch(err) {
            defaultError(err);
        };
    });

    //this will setup the password for 1st user
    gJitsiApi.on('participantRoleChanged', (event) => {
        try {
            if (event.role === 'moderator') {
                gJitsiApi.executeCommand('password', gConfigOptions.roomPass);
            }
        } catch(err) {
            defaultError(err);
        };
    });

    //These two for when people join or leave. Do stuff if more than 1 person in room.
    gJitsiApi.on('participantJoined', (event) => {
        try {
            onPartitipantsChange();
        } catch(err) {
            defaultError(err);
        };
    });

    gJitsiApi.on('participantLeft', (event) => {
        try {
            onPartitipantsChange();
        } catch(err) {
            defaultError(err);
        };
    });

    //On error log, reload. This is resilient/simple enough to not require try/catch
    gJitsiApi.on('log', (event) => {
        if (event.logLevel === 'error') {
            hangupAndDispose(gJitsiApi);
            location.reload();
        }
    });

    gJitsiApi.on('endpointTextMessageReceived', (event) => {
        try {
            decryptAndHandleMsg(event.data.eventData.text,
                base64ToBytes(gConfigOptions.controlKey),
                msgHandler);
        } catch(err) {
            defaultError(err);
        };
    });

    /* Make some variables and functions available for debugging */
    window.configOptions = gConfigOptions;
    window.gJitsiApi = gJitsiApi;
    window.saveConfig = saveConfig;
    window.clearConfig = clearConfig;
    window.configToHash = () => {
        return configToHash(gConfigOptions)
    }
}

catch(err) {
    defaultError(err);
}
