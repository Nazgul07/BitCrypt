const {ipcRenderer} = require('electron');
const FileSystem = require('fs');
const remote = require('electron').remote
const Path = require('path');

var uiHandler;

class UIHandler {
  constructor() {
    this.progressBar = document.querySelector('.progress-bar');
    this.progress = document.querySelector('.progress-bar span');

    this.LockDrop = document.querySelector('#lock-zone');
    this.LockDrop.ondragover = this.dragStart.bind(this);
    this.LockDrop.ondragenter = this.stopEvent.bind(this);
    this.LockDrop.ondrop = this.onLockDrop.bind(this);
    this.LockDrop.ondragleave = this.dragLeave.bind(this);
    this.LockDrop.onclick = this.onLockClick.bind(this);

    this.UnLockDrop = document.querySelector('#unlock-zone');
    this.UnLockDrop.ondragover = this.dragStart.bind(this);
    this.UnLockDrop.ondragenter = this.stopEvent.bind(this);
    this.UnLockDrop.ondrop = this.onUnLockDrop.bind(this);
    this.UnLockDrop.ondragleave = this.dragLeave.bind(this);
    this.UnLockDrop.onclick = this.onUnLockClick.bind(this);
  }

  dragStart(event) {
    this.stopEvent(event);
    event.target.classList.add('dragging');
  }

  dragLeave(event) {
    this.stopEvent(event);
    event.target.classList.remove('dragging');
  }

  onLockClick(event) {
    this.onLockDrop(this.openFileDialog(event));
  }

  onUnLockClick(event) {
    this.onUnLockDrop(this.openFileDialog(event));
  }

  openFileDialog(event){
    var filesList = remote.dialog.showOpenDialog() || [];
    var files = [];
    filesList.forEach(function(file) {
      files.push({
        path:file,
        name: Path.basename(file)
      });
    }, this);
    event.dataTransfer = {
      files: files
    };
    return event;
  }

  onLockDrop(event) {
    event.preventDefault();
    event.stopPropagation();

    event.target.classList.remove('dragging');

    var dt = event.dataTransfer;
    var files = dt.files;
    var fileList = [];
    for (var i = 0; i < files.length; i++) {
      if(files[i].name.endsWith(".bc")){
        alert("Cannot lock a BitCrypt file: '" + files[i].name + "'.", 'BitCrypt')
        return false;
      }
      fileList.push({
        path: files[i].path,
        name: files[i].name
      });
    }
    if(fileList.length > 0){
      this.progress.style.width = '100%';
      uiHandler.progressBar.classList.remove('blue');
      uiHandler.progressBar.classList.add('gray');
      ipcRenderer.send('file-upload', fileList, document.querySelector('#delete-files').checked);
    }
    return false;
  }

  onUnLockDrop(event) {
    event.preventDefault();
    event.stopPropagation();

    event.target.classList.remove('dragging');

    var dt = event.dataTransfer;
    var files = dt.files;
    var fileList = [];
    for (var i = 0; i < files.length; i++) {
      if(!files[i].name.endsWith(".bc")){
        alert("The file '" + files[i].name + "' is not a BitCrypt file.", 'BitCrypt')
        return false;
      }
      fileList.push({
        path: files[i].path,
        name: files[i].name
      });
    }
    if(fileList.length > 0){
      this.progress.style.width = '100%';
      uiHandler.progressBar.classList.remove('blue');
      uiHandler.progressBar.classList.add('gray');
      ipcRenderer.send('file-upload', fileList, document.querySelector('#delete-files').checked);
    }
    return false;
  }

  stopEvent(event) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    return false;
  }

  promptForUnlock(message, hint, callback, validationError) {
    var promptBox = document.querySelector('#unlock-prompt');
    promptBox.style.display = 'block';

    var promptInput = promptBox.querySelector('#password-input');
    promptInput.value = '';
    var errorMessage = promptBox.querySelector('#error-message');
    errorMessage.innerText = '';
    if (validationError) {
      errorMessage.innerText = validationError;
    }
    var promptMessage = promptBox.querySelector('span');
    promptMessage.innerText = message;
    var hintMessage = promptBox.querySelector('#password-hint');
    hintMessage.innerText = "Hint: " + hint;
    var form = promptBox.querySelector('form');
    form.onsubmit = function () {
      promptBox.style.display = 'none';
      callback(promptInput.value);
    }
    var cancel = promptBox.querySelector('#password-button-cancel');
    cancel.onclick = function () {
      promptBox.style.display = 'none';
      this.progressBar.style.display = 'none';
    }.bind(this);
  }

  promptForLock(message, callback, validationError) {
    var promptBox = document.querySelector('#lock-prompt');
    promptBox.style.display = 'block';

    var promptInput = promptBox.querySelector('#password-input');
    promptInput.value = '';
    var confirmInput = promptBox.querySelector('#confirm-input');
    confirmInput.value = '';

    function validatePassword(){
      if(promptInput.value != confirmInput.value) {
        confirmInput.setCustomValidity("Passwords Don't Match");
      } else {
        confirmInput.setCustomValidity('');
      }
    }

    promptInput.onchange = validatePassword;
    confirmInput.onkeyup = validatePassword;


    var hintInput = promptBox.querySelector('#hint-input');
    hintInput.value = '';
    if (validationError) {
      var errorMessage = promptBox.querySelector('#error-message');
      errorMessage.innerText = validationError;
    }
    var promptMessage = promptBox.querySelector('span');
    promptMessage.innerText = message;
    var form = promptBox.querySelector('form');
    form.onsubmit = function () {
      promptBox.style.display = 'none';
      callback(promptInput.value, hintInput.value);
    }
    var cancel = promptBox.querySelector('#password-button-cancel');
    cancel.onclick = function () {
      promptBox.style.display = 'none';
      this.progressBar.style.display = 'none';
    }.bind(this);
  }
}

ipcRenderer.on('message', function (event, message) {
  alert(message, 'BitCrypt');
});

ipcRenderer.on('get-unlock-password', function (event, file, hint, validationError) {
  uiHandler.promptForUnlock("Please enter the password for the file '" + file + "'", hint, function (password) {
    ipcRenderer.send('supply-unlock-password', password);
  }, validationError);
});

ipcRenderer.on('get-lock-password', function (event) {
  uiHandler.promptForLock("Please enter a password:", function (password, passwordHint) {
    ipcRenderer.send('supply-lock-password', password, passwordHint);
  });
});


ipcRenderer.on('show-progress', function (event, message) {
 uiHandler.progressBar.style.display = 'block';
});

ipcRenderer.on('progress-update', function (event, value) {
  uiHandler.progress.style.width = (value * 100) + '%';
   uiHandler.progressBar.classList.add('blue');
   uiHandler.progressBar.classList.remove('gray');
  if (value == 1) {
    setTimeout(function () { uiHandler.progressBar.style.display = 'none'; }, 1000);
  }
});

ipcRenderer.on('confirm', function (event, message) {
  if(confirm(message, 'BitCrypt')){
    ipcRenderer.send('confirmed');
  }
});

document.addEventListener("DOMContentLoaded", function (event) {
  uiHandler = new UIHandler();
});

function insertAfter(newNode, referenceNode) {
    referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
}