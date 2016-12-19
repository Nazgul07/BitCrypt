const {app, BrowserWindow, ipcMain} = require('electron');
const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const rootPath = path.dirname(__dirname);

let win;
let iconPath = rootPath + '/client/images/icons';

function createWindow() {
  // Create the browser window.
  win = new BrowserWindow({
    height: 245,
    resizable: false,
    maximizable: false,
    width: 400,
    transparent: os.platform == 'win32' ? true : false,
    icon: os.platform == 'win32' ? iconPath + '/BitCrypt.ico' : iconPath + '/BitCrypt.png',
    titleBarStyle: os.platform == 'win32' ? 'default' : 'hidden',
  });

  win.webContents.on('will-navigate', function (event) {
    event.preventDefault();
  });

  win.setMenu(null);
  // and load the index.html of the app.
  win.loadURL('file://' + rootPath + '/client/index.html');

  // Open the DevTools.
  //win.webContents.openDevTools();

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow();
  }
});



var finishedCount = 0;
var fileCount = 0;
var files;
var lockPassword;
var lockPasswordHint;
var confirmed;
var deleteWhenDone;

ipcMain.on('supply-lock-password', function (event, password, passwordHint) {
  if (password == null || password.length == 0) {
    event.sender.send('message', 'Password must be set.');
  }
  lockPassword = password;
  lockPasswordHint = passwordHint;
  lock(files, event);
});

function lock(files, event) {
  while (files.length > 0) {
    var file = files.pop();
    var destination = file.path + '.bc';
    if (file.name.endsWith('.bc')) {
      files.push(file);
      break;
    }
    if(fs.existsSync(destination) && !confirmed){
      files.push(file);
      event.sender.send('confirm', "File '" + destination +"' already exists, do you want to overwrite it?");
      return;
    }
    confirmed = false;
    if (fs.lstatSync(file.path).isDirectory()) {
      event.sender.send('message', 'Cannot encrypt a directory.');
      event.sender.send('progress-update', ++finishedCount / fileCount);
      continue;
    }
    var cipher = crypto.createCipher('aes-256-cbc', lockPassword),
      passwordCipher = crypto.createCipher('aes-256-cbc', lockPassword),
      headerCipher = crypto.createCipher('aes-256-cbc', 'headerKey'),
      input = fs.createReadStream(file.path),
      output = fs.createWriteStream(destination);
    output.write(headerCipher.update(lockPasswordHint, 'utf8', 'binary') + headerCipher.final('binary') + '\n\n');
    output.write(passwordCipher.update(lockPasswordHint, 'utf8', 'binary') + passwordCipher.final('binary') + '\n\n');
    input.pipe(cipher).pipe(output);

    var progressShown = false;
    input.on('data', function (){
        if(!progressShown){
          progressShown = true;
          event.sender.send('show-progress');
        }
    });
    output.on('finish', function () {
      if(deleteWhenDone){
         fs.unlink(file.path);
      }
      event.sender.send('progress-update', ++finishedCount / fileCount);
    });
  }

  if (files.length > 0) {
    checkNextFile(event);
  }
}

function unLock(files, event) {
  var file = files.pop();
  var destination = file.path.substring(0, file.path.length - 3);
  if (!file.name.endsWith('.bc')) {
    files.push(file);
  }
  else {
    var cipher = crypto.createDecipher('aes-256-cbc', file.password),
      passwordCipher = crypto.createDecipher('aes-256-cbc', file.password),
      headerCipher = crypto.createDecipher('aes-256-cbc', 'headerKey'),
      input = fs.createReadStream(file.path);
     
    
    parseHeader(input, function (error, header, stream) {
      if(error) event.sender.send('message', 'An error occured.');
      var hintHeader = headerCipher.update(header, 'binary', 'utf8') + headerCipher.final('utf8');
      parseHeader(input, function (error, header, stream) {
        if(error) event.sender.send('message', 'An error occured.');
        var errorHandler = function() {
          stream.close();
          files.push(file);
          event.sender.send('get-unlock-password', files[files.length - 1].name, hintHeader, "Password invalid.");
          return;
        }

        var finishUnlocking = function () {
          if(fs.existsSync(destination) && !confirmed && !sentConfirm){
            files.push(file);
            event.sender.send('confirm', "File '" + destination +"' already exists, do you want to overwrite it?");
            stream.unpipe();
            stream.close();
            sentConfirm = true;
            return;
          }
          var output = fs.createWriteStream(destination);
          var sentConfirm = false;
          var progressShown = false;
          stream.on('data', function (chunk){
              if(!progressShown){
                progressShown = true;
                event.sender.send('show-progress');
              }
          });
          output.on('finish', function () {
            if(deleteWhenDone){
              fs.unlink(file.path);
            }
            event.sender.send('progress-update', ++finishedCount / fileCount);
            confirmed = false;
          });
          stream.pipe(cipher).on('error', errorHandler).pipe(output);
        }

        if(header != null){//the file is the new version with the password verify header
          try{
            var passwordVerifyHeader = passwordCipher.on('error', errorHandler).update(header, 'binary', 'utf8') + passwordCipher.final('utf8');
            finishUnlocking();
          }
          catch(e){
            errorHandler();
            return;
          }
        }
        else {
          //the file is an old version, and we need to reset the stream, stream.unshift doesn't seem to work.
          stream.close();
          stream = fs.createReadStream(file.path);
          parseHeader(stream, function (error, header, stream) {
            finishUnlocking();
          });
        }

      }, true);
    });
  }
  if (files.length > 0) {
    checkNextFile(event);
  }
}

ipcMain.on('supply-unlock-password', function (event, password) {
  files[files.length - 1].password = password;
  unLock(files, event);
});

ipcMain.on('confirmed', function (event) {
  confirmed = true;
  checkNextFile(event);
});

ipcMain.on('file-upload', function (event, fileList, deleteFiles) {
  finishedCount = 0;
  fileCount = fileList.length;
  lockPassword = '';
  files = fileList;
  deleteWhenDone = deleteFiles;
  checkNextFile(event);
});

function checkNextFile(event) {
  if (files[files.length - 1].name.endsWith(".bc")) {
    if(files[files.length - 1].password){
      unLock(files, event);
    }
    else {
      var headerCipher = crypto.createDecipher('aes-256-cbc', 'headerKey'),
      input = fs.createReadStream(files[files.length - 1].path);
    
      parseHeader(input, function (error, header, stream) {
        if(error) event.sender.send('message', 'An error occured.');
        var realHeader = headerCipher.update(header, 'binary', 'utf8') + headerCipher.final('utf8');
        event.sender.send('get-unlock-password', files[files.length - 1].name, realHeader);
        stream.close();
      });
    }
  }
  else {
    if (lockPassword == '') {
      event.sender.send('get-lock-password');
    }
    else {
      lock(files, event);
    }
  }
}



const StringDecoder = require('string_decoder').StringDecoder;
function parseHeader(stream, callback, alreadyReading) {
  const decoder = new StringDecoder('utf8');
  var header = '';
  stream.on('error', callback);
  if(!alreadyReading)
    stream.on('readable', onReadable);
  else 
    onReadable();
  function onReadable() {
    var chunk;
    var count = 0;
    while ((!alreadyReading || ++count < 500) && null !== (chunk = stream.read(1))) {
      var str = decoder.write(chunk);
      if ((header + str).match(/\n\n/)) {
        // found the header boundary
        stream.removeListener('error', callback);
        stream.removeListener('readable', onReadable);
        // now the body of the message can be read from the stream.
        callback(null, header.replace(new RegExp(str + '$'), ''), stream);
        break;
      } else {
        // still reading the header.
        header += str;
      }
    }
    if(count == 500){
      callback(null, null, stream);
    }
  }
}
