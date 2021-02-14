import { generateKey, generatePassword } from "./random.js"
import { bytesToBase64, base64ToBytes } from "./base64.js"
import { hangupAndDispose, encryptAndHandleMsg, decryptAndHandleMsg, configToHash } from "./meet-common.js"

function inElectronRenderer() {
    if ((window && window.process && window.process.type) == "renderer") return true;
    else return false;
}

/* If we hit an error, try to hangup the reload after a bit */
function defaultError(err) {
    console.error(err);
    hangupAndDispose(gJitsiApi);
    setTimeout(() => {location.reload()}, 5000);
}

/* Set the width of the sidebar to 250px and the left margin of the page content to 250px */
function openSidebar() {
    document.getElementById("sidebar").style.width = "25%";
    var jitsiIFrame = gJitsiApi.getIFrame();
    jitsiIFrame.style.marginLeft = "25%";
    jitsiIFrame.style.width = "75%";
}
  
/* Set the width of the sidebar to 0 and the left margin of the page content to 0 */
function closeSidebar() {
    document.getElementById("sidebar").style.width = "0";
    var jitsiIFrame = gJitsiApi.getIFrame();
    jitsiIFrame.style.marginLeft = "0";
    jitsiIFrame.style.width = "100%";
}

function toggleConfig() {
    gTmpState.configOpen = !gTmpState.configOpen;
    updateDisplay(getNumberOfParticipants() > 1);
}

function getNumberOfParticipants() {
    const participantInfo = gJitsiApi.getParticipantsInfo();
    let numOut = participantInfo.length;
    console.log("Original number of participants:");
    console.log(numOut);
    for (var participant of participantInfo) {
        if (participant.displayName == "CONTROL") {
            console.log("CONTROL user detected");
            numOut -= 1;
        }
    }
    return numOut;
}

function updateQR() {
    // Only need to update the control QR
    // If we change the room name, we reload anyway which generates a new joinQR
    gControlQR.clear();
    gControlQR.makeCode(gControlUrlBase + configToHash(gConfigOptions));
}

function updateDisplay(inCall) {
    document.getElementById("roomName").value = gConfigOptions.roomName;
    document.getElementById("roomPass").innerHTML = gConfigOptions.roomPass;
    document.getElementById("roomPassBox").value = gConfigOptions.roomPass;
    document.getElementById("displayName").value = gConfigOptions.displayName;
    document.getElementById("autoHdmi").checked = gConfigOptions.autoHdmi;
    document.getElementById("showConfig").checked = gConfigOptions.showConfig;
    document.getElementById("localMute").checked = gConfigOptions.localMute;

    if (gTmpState.configOpen) {
        document.getElementById("joinInfo").style.display = "none";
        document.getElementById("controlInfo").style.display = "none";
        document.getElementById("config").style.display = "block";
    } else {
        document.getElementById("joinInfo").style.display = "block";
        document.getElementById("config").style.display = "none";

        if (gConfigOptions.showConfig) {
            document.getElementById("controlInfo").style.display = "block";
        } else {
            document.getElementById("controlInfo").style.display = "none";
        }
    }

    if (inCall) {
        closeSidebar();
    } else {
        if (gConfigOptions.showSidebar) {
            openSidebar();
        } else {
            closeSidebar();
        }
    }
}

function getHdmi() {
    if (!gTmpState.cecLock) {
        gTmpState.cecLock = true;
        const cecLockTimeout = setTimeout(() => {gTmpState.cecLock = false;}, 60000);

        const cecCtl = new CecController();
        
        async function readyHandler(controller)
        {
            const powerStatus = controller.dev0.powerStatus;     

            if (powerStatus != "on") {
                gTmpState.turnOffTV = (powerStatus == "off" || powerStatus == "standby")
                await controller.dev0.turnOn();
            }  
            await controller.setActive();
            
            clearTimeout(cecLockTimeout);
            gTmpState.cecLock = false;
        }    
        
        cecCtl.on('ready', readyHandler);
        cecCtl.on('error', console.error);
    }
}

function ungetHdmi() {    
    if (!gTmpState.cecLock) {
        gTmpState.cecLock = true;
        const cecLockTimeout = setTimeout(() => {gTmpState.cecLock = false;}, 60000);

        const cecCtl = new CecController();
        
        async function readyHandler(controller)
        {
            await controller.setInactive();

            if (gTmpState.turnOffTV) {
                gTmpState.turnOffTV = false;
                await controller.dev0.turnOff();
            }
            
            clearTimeout(cecLockTimeout);
            gTmpState.cecLock = false;
        }    
        
        cecCtl.on('ready', readyHandler);
        cecCtl.on('error', console.error);
    }
}

function onPartitipantsChange() {
    const inCall = getNumberOfParticipants() > 1;
    updateDisplay(inCall);

    if (inElectronRenderer() && gConfigOptions.autoHdmi) {
        try {
            if (inCall) getHdmi();
            else ungetHdmi();
        } catch(err) {
            console.log("Error with HDMI");
            console.error(err);
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
    let reloadFlag = false;

    for (var key in configIn) {
        if (key in gConfigOptions && gConfigOptions[key] != configIn[key]) {
            switch(key) {
                case "roomPass":
                    console.log("Updating password");
                    gJitsiApi.executeCommand('password', configIn.roomPass);
                    break
                case "roomName":
                    reloadFlag = true;
                    break;
                case "displayName":
                    gJitsiApi.executeCommand('displayName', configIn.displayName);
                    break;
                default:
                    break;
            }
            gConfigOptions[key] = configIn[key];
        }
    }

    // New config parsed just fine, time for an update!
    // Save new config locally
    saveConfig();

    // May need a reload
    if (reloadFlag) {
        console.log("Reloading due to config update...");
        hangupAndDispose(gJitsiApi);
        location.reload();
    } else {
        // Otherwise run these functions to update display
        updateQR();
        updateDisplay(getNumberOfParticipants() > 1);
        updateMuteStatus();
    }
}

function applyNewConfigLocally() {
    applyNewConfig({
        roomName: document.getElementById("roomName").value,
        roomPass: document.getElementById("roomPassBox").value,
        displayName: document.getElementById("displayName").value,
        autoHdmi: document.getElementById("autoHdmi").checked,
        showConfig: document.getElementById("showConfig").checked,
        localMute: document.getElementById("localMute").checked
    })
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
    var gTmpState = {
        turnOffTV: false,
        cecLock: false,
        configOpen: false
    }

    if (inElectronRenderer()) var CecController = require('cec-controller');
    else var CecController = null;

    getStoredConfig();
    saveConfig();

    var domain = "meet.jit.si";
    var joinUrlBase = "https://" + domain + '/';
    var gControlUrlBase = "https://jackalstew.github.io/managed-meet/control.html#";

    document.getElementById("roomUrl").href = joinUrlBase + gConfigOptions.roomName;
    document.getElementById("roomUrl").innerHTML = joinUrlBase + gConfigOptions.roomName;

    document.getElementById("roomPass").innerHTML = gConfigOptions.roomPass;

    document.getElementById("controlUrl").href = gControlUrlBase;

    const qrSize = 256;

    var gJoinQR = new QRCode(document.getElementById("joinQR"), {
        text: joinUrlBase + gConfigOptions.roomName,
        width: qrSize,
        height: qrSize,
        colorDark: window.getComputedStyle(document.getElementById("joinInfo")).color,
        colorLight: window.getComputedStyle(document.getElementById("joinInfo")).backgroundColor,
        correctLevel: QRCode.CorrectLevel.L
    });

    var gControlQR = new QRCode(document.getElementById("controlQR"), {
        text: gControlUrlBase + configToHash(gConfigOptions),
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

    updateDisplay(false);

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

    updateDisplay(getNumberOfParticipants() > 1);

    /* Make some variables and functions available for debugging */
    window.configOptions = gConfigOptions;
    window.gJitsiApi = gJitsiApi;
    window.saveConfig = saveConfig;
    window.clearConfig = clearConfig;
    window.toggleConfig = toggleConfig;
    window.applyNewConfigLocally = applyNewConfigLocally;
    window.configToHash = () => {
        return configToHash(gConfigOptions)
    }
}

catch(err) {
    defaultError(err);
}
