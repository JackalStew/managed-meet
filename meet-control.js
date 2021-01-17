import { base64ToBytes } from "./base64.js"
import { hangupAndDispose, encryptAndHandleMsg, decryptAndHandleMsg, hashToConfig, configToHash } from "./meet-common.js"

function sendMsg(msgOut) {
    gJitsiApi.executeCommand('sendEndpointTextMessage', '', msgOut);
}

function getConfigInfo() {
    encryptAndHandleMsg({
        type: "getConfig"
    }, base64ToBytes(gMinConfig.controlKey), sendMsg)
}

function setConfigInfo() {
    encryptAndHandleMsg({
        type: "setConfig",
        config: {
            roomName: document.getElementById("roomName").value,
            roomPass: document.getElementById("roomPass").value,
            autoHdmi: document.getElementById("autoHdmi").checked,
            showSidebar: document.getElementById("showSidebar").checked,
            showConfig: document.getElementById("showConfig").checked,
            localMute: document.getElementById("localMute").checked
        }
    }, base64ToBytes(gMinConfig.controlKey), sendMsg);

    // Update our min config too
    gMinConfig.roomName = document.getElementById("roomName").value;
    gMinConfig.roomPass = document.getElementById("roomPass").value;
    updateHashAndReload();
}

function updateHashAndReload() {
    const newHash = configToHash(gMinConfig);
    if (newHash != location.hash.substring(1)) {
        console.log("There was a change, reloading...")
        location.hash = '#' + newHash;
        setTimeout(() => {location.reload()}, 1000);
    }
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

            // Now update our minconfig object
            for (var key in gMinConfig) {
                gMinConfig[key] = msgObj.config[key]
            }

            console.log("Config information set")

            // Reload if anything caused a change to fundamental parameters (room name or key)
            // Verify this by checking the hash
            updateHashAndReload();

            break;
    }
}

if (location.hash.length > 1) {
    try {
        var gMinConfig = hashToConfig(location.hash.substring(1));
        document.getElementById("roomName").value = gMinConfig.roomName;
        document.getElementById("roomPass").value = gMinConfig.roomPass;

        var domain = "meet.jit.si";

        var options = {
            roomName: gMinConfig.roomName,
            width: 0,
            height: 0,
            parentNode: undefined,
            userInfo: {
                displayName: "CONTROL"
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
            gJitsiApi.executeCommand('password', gMinConfig.roomPass);
        });

        // when local user has joined the video conference 
        gJitsiApi.addEventListener('videoConferenceJoined', (response) => {
            gJitsiApi.executeCommand('password', gMinConfig.roomPass);
            // Bit of a hack. Wait a bit after joining until config request
            setTimeout(() => {getConfigInfo()}, 1000);
        });

        //this will setup the password for 1st user
        gJitsiApi.on('participantRoleChanged', (event) => {
            if (event.role === 'moderator') {
                gJitsiApi.executeCommand('password', gMinConfig.roomPass);
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
            decryptAndHandleMsg(event.data.eventData.text,
                base64ToBytes(gMinConfig.controlKey),
                controlMsgHandler);
        });

        window.getConfigInfo = getConfigInfo;
        window.setConfigInfo = setConfigInfo;
        window.hangupAndDispose = () => {
            hangupAndDispose(gJitsiApi);
        };
    }

    catch(err) {
        console.log("Caught error", err);
        hangupAndDispose(gJitsiApi);
        setTimeout(() => {location.reload()}, 5000);
    }
}
