# BitCrypt
A simple File Encryption application for Windows (Mac in development). Encrypt your bits.

![alt text](https://raw.githubusercontent.com/Nazgul07/BitCrypt/master/Screenshot.PNG "ScreenShot")
###[Download for Windows](https://github.com/Nazgul07/BitCrypt/releases)

## Development install and launch
```
git clone https://github.com/Nazgul07/BitCrypt.git
cd BitCrypt
npm install
npm start
```

## Build on Mac
```
npm run build  // build unpacked dir. Useful to test
npm run pack:windows // build for Windows
npm run pack:mac // build for Mac
npm run pack:linux  // build for Linux
npm run dist:all  // build for Windows, Mac and Linux
```
[Build Multi-Platform](https://github.com/electron-userland/electron-builder/wiki/Multi-Platform-Build)

[electron-builder Documentation](https://www.npmjs.com/package/electron-builder)

## Build on Windows
```
python script\bootstrap.py -v
python script\build.py
```
[Build Instructions by Electron](http://electron.atom.io/docs/development/build-instructions-windows)

