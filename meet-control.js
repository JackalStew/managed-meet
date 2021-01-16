import { bytesToBase64, base64ToBytes } from "./base64.js"
import { hangupAndDispose, encryptAndHandleMsg, decryptAndHandleMsg } from "./meet-common.js"

function generateConfig() {
    var thisConfig = {
        displayName: "control",
        roomName: "DuncyTestingRoom",
        roomPass: "boop",
        showJoinInfo: true,
        showConfigInfo: true
    }//*/
    /*
    var thisConfig = {
        displayName: "TestDN",
        roomName: generatePassword(4),
        roomPass: generatePassword(4),
        showJoinInfo: true,
        showConfigInfo: true
    }*/
    return thisConfig;
}

function getConfig() {
    // start with a blank slate
    var thisConfig = generateConfig();
    var tempConfig = {};

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

    return thisConfig;
}

function hashToConfig(hashString) {
    return JSON.parse(atob(hashString));
}

function configToHash(tempConfig) {
    return btoa(JSON.stringify(tempConfig));
}

function sendMsg(msgOut) {
    gJitsiApi.executeCommand('sendEndpointTextMessage', '', msgOut);
}

function getConfigInfo() {
    encryptAndHandleMsg({
        type: "getConfig"
    }, keyBytes, sendMsg)
}

function controlMsgHandler(msgObj) {
    switch (msgObj.type) {
        case "config":
            console.log("Config information received")
            console.log(msgObj.config)
            document.getElementById("roomName").value = msgObj.config.roomName;
            document.getElementById("roomPass").value = msgObj.config.roomPass;

            for (const id of ["autoHdmi", "showSidebar", "showConfig", "localMute"]) {
                document.getElementById(id).checked = msgObj.config[id];
            }
            console.log("Config information set")

            break;
    }
}

try {
    var configJSON = getConfig();

    var keyBytes = new Uint8Array(16);

    var domain = "meet.jit.si";

    var options = {
        roomName: configJSON.roomName,
        width: 0,
        height: 0,
        parentNode: undefined,
        userInfo: {
            displayName: configJSON.displayName
        },
        configOverwrite: {
            prejoinPageEnabled: false,
            startWithVideoMuted: true,
            startWithAudioMuted: true,
            startAudioOnly: true,
            startSilent: true
        },
        interfaceConfigOverwrite: {},
    }
    var gJitsiApi = new JitsiMeetExternalAPI(domain, options);

    // when local user is trying to enter in a locked room
    gJitsiApi.addEventListener('passwordRequired', () => {
        gJitsiApi.executeCommand('password', configJSON.roomPass);
    });

    // when local user has joined the video conference 
    gJitsiApi.addEventListener('videoConferenceJoined', (response) => {
        gJitsiApi.executeCommand('password', configJSON.roomPass);
        // Bit of a hack. Wait a bit after joining until config request
        setTimeout(() => {getConfigInfo()}, 1000);
    });

    //this will setup the password for 1st user
    gJitsiApi.on('participantRoleChanged', (event) => {
        if (event.role === 'moderator') {
            gJitsiApi.executeCommand('password', configJSON.roomPass);
        }
    });

    //On error log, reload.
    gJitsiApi.on('log', (event) => {
        if (event.logLevel === 'error') {
            hangupAndDispose(gJitsiApi);
            location.reload();
        }
    });

    gJitsiApi.on('endpointTextMessageReceived', (event) => {
        decryptAndHandleMsg(event.data.eventData.text, keyBytes, controlMsgHandler);
    });

    window.getConfigInfo = getConfigInfo;
    window.hangupAndDispose = () => {
        hangupAndDispose(gJitsiApi);
    };
}

catch(err) {
    console.log("Caught error", err);
    hangupAndDispose(gJitsiApi);
    setTimeout(() => {location.reload()}, 5000);
}
