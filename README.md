# AutoJitsi
AutoJitsi started as a wraper for the Jitsi Meet web API, which would automatically join the room and reload if the connection breaks. From there I went crazy and added more features. Now it does the following:
- Automatically join the meeting room, and reload if there is an error
- Settings may be changed remotely
- Display QR codes to join and configure the meeting on screen
- Automatically switch input and turn on TV when in a call (requires HDMI CEC compliant TV and device such as Raspberry Pi)

If you've never used Jitsi, it's a pretty decent VTC service. More info on their site: https://jitsi.org/user-faq/

Remote configuration is available by scanning the QR code on screen. Control messages are further secured with AES-128-GCM, so only someone in posession of the URL/QR will be able to configure remotely.

If running the electron app on a capable setup, and auto HDMI is enabled, the TV's input will automatically be switched (turning on the TV if needed) when at least one other participant has joined.

You can try it out in browser (without HDMI switching of course): https://jackalstew.github.io/managed-meet/client.html

This runs just fine on a Raspberry Pi 4 (a 3 can run it, but VERY slowly!)

## Installation guide on Raspberry Pi (recommended)
1) Download the latest .deb file from the releases page: https://github.com/JackalStew/managed-meet/releases

2) Install it, e.g:
    ```
    sudo dpkg -i autojisti_1.0.0_armhf.deb
    ```

3) Install unclutter to hide cursor when idle:
    ```
    sudo apt install unclutter
    ```

4) Ensure a camera is plugged in to the Rasberry Pi. Configure the Pi by right clicking on the speaker icon in the top right, ensure correct input/output devices are selected.

5) Set unclutter and Auto Jitsi to run on startup by adding the following lines to /etc/xdg/lxsession/LXDE-pi/autostart:
    ```
    @autojitsi
    @unclutter -idle 1
    ```

6) Open a terminal and run:
    ```
    autojitsi &
    unclutter -idle 1
    ```

## Notes on Security
Jitsi have documented their security design quite well: https://jitsi.org/security/

Unfortunately, full E2E encryption doesn't appear to be currently supported by the Web API or mobile apps, but if that changes I'll try to implement it here.

All remote configuration traffic has a custom layer of AES-128-GCM encryption, meaning it can only be decrypted and issued by someone with the configuration URL or QR code. Even the Jitsi service lacks the keys required to decrypt this traffic or issue commands.

## Credits
Jitsi Meet powers all the actual meeting stuff: https://meet.jit.si/

QR code generation code (it's excellent) by https://davidshimjs.github.io/qrcodejs/

I made this as a lockdown project so my family could communicate with our elderly relatives, I hope someone else might get some similar use out of it. If you like what you see, please consider donating: https://paypal.me/jackalstew
