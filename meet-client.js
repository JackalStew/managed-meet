import { generateKey, generatePassword } from "./random.js"
import { bytesToBase64, base64ToBytes } from "./base64.js"
import { hangupAndDispose, encryptAndHandleMsg, decryptAndHandleMsg, configToHash } from "./meet-common.js"

function inElectronRenderer() {
    if ((window && window.process && window.process.type) == "renderer") return true;
    else return false;
}

/* Set the width of the sidebar to 250px and the left margin of the page content to 250px */
function openSidebar() {
    document.getElementById("mySidebar").style.width = "25%";
    var jitsiIFrame = gJitsiApi.getIFrame();
    jitsiIFrame.style.marginLeft = "25%";
    jitsiIFrame.style.width = "75%";
}
  
/* Set the width of the sidebar to 0 and the left margin of the page content to 0 */
function closeSidebar() {
    document.getElementById("mySidebar").style.width = "0";
    var jitsiIFrame = gJitsiApi.getIFrame();
    jitsiIFrame.style.marginLeft = "0";
    jitsiIFrame.style.width = "100%";
}

function onPartitipantsChange() {
    if (gJitsiApi.getNumberOfParticipants() > 1) {
        closeSidebar();
    } else {
        openSidebar();
    }
}

function generateConfig() {
    /*var thisConfig = {
        displayName: "TestDN",
        roomName: "DuncyTestingRoom",
        roomPass: "boop",
        showJoinInfo: true,
        showConfigInfo: true
    }*/
    var thisConfig = {
        displayName: "TestDN",
        roomName: generatePassword(4),
        roomPass: generatePassword(4),
        controlKey: bytesToBase64(new Uint8Array(16)),
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

    /*
    if (location.hash.length > 1) {
        // Try to read from location has variables
        try {
            tempConfig = hashToConfig(location.hash.substring(1));
            for (var key in thisConfig) {
                if (key in tempConfig) {
                    thisConfig[key] = tempConfig[key]
                }
            }
        } catch {};
    }
    */

    gConfigOptions = thisConfig;

    // TODO: Get key bytes from storage
    //keyBytes = generateKey();
}

function saveConfig() {
    localStorage.setItem("config", JSON.stringify(gConfigOptions));
}

function clearConfig() {
    localStorage.setItem("config", null);
}

function applyNewConfig(configIn) {
    let newPassFlag = false;
    let reloadFlag = false;

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

    // Let all controllers know the new deets
    encryptAndHandleMsg({
        type: "config",
        config: gConfigOptions
    }, base64ToBytes(gConfigOptions.controlKey), sendMsg);

    // May need a reload
    if (reloadFlag) {
        console.log("Reloading due to config update...");
        hangupAndDispose(gJitsiApi);
        location.reload();
    } else {
        // Otherwise run this function to update display
        onPartitipantsChange();
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
    }
}

try {
    var gConfigOptions = null;

    getStoredConfig();
    saveConfig();

    var domain = "meet.jit.si";
    var joinUrl = "https://" + domain + '/' + gConfigOptions["roomName"];
    var controlUrl = "https://jackalstew.github.io/managed-meet/control.html#" + configToHash(gConfigOptions)

    document.getElementById("roomURL").href = joinUrl;
    document.getElementById("roomURL").innerHTML = joinUrl;

    document.getElementById("roomPass").innerHTML = gConfigOptions["roomPass"];

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
        gJitsiApi.executeCommand('password', gConfigOptions.roomPass);
    });

    // when local user has joined the video conference 
    gJitsiApi.addEventListener('videoConferenceJoined', (response) => {
        gJitsiApi.executeCommand('password', gConfigOptions.roomPass);
    });

    //this will setup the password for 1st user
    gJitsiApi.on('participantRoleChanged', (event) => {
        if (event.role === 'moderator') {
            gJitsiApi.executeCommand('password', gConfigOptions.roomPass);
        }
    });

    //These two for when people join or leave. Do stuff if more than 1 person in room.
    gJitsiApi.on('participantJoined', (event) => {
        onPartitipantsChange();
    });
    gJitsiApi.on('participantLeft', (event) => {
        onPartitipantsChange();
    });

    //On error log, reload.
    gJitsiApi.on('log', (event) => {
        if (event.logLevel === 'error') {
            hangupAndDispose(gJitsiApi);
            location.reload();
        }
    });

    gJitsiApi.on('endpointTextMessageReceived', (event) => {
        decryptAndHandleMsg(event.data.eventData.text,
            base64ToBytes(gConfigOptions.controlKey),
            msgHandler);
    });

    window.configOptions = gConfigOptions;
    window.saveConfig = saveConfig;
    window.clearConfig = clearConfig;
    window.configToHash = () => {
        return configToHash(gConfigOptions)
    }
}

catch(err) {
    console.log("Caught error", err);
    hangupAndDispose(gJitsiApi);
    setTimeout(() => {location.reload()}, 5000);
}
