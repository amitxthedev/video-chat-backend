let videoWaitingUser = null;
let textWaitingUser = null;

/**
 * Add user to waiting queue based on chat type
 */
function addToQueue(socket, chatType = "video") {
  socket.chatType = chatType;
  if (chatType === "text") {
    textWaitingUser = socket;
  } else {
    videoWaitingUser = socket;
  }
}

/**
 * Remove user from waiting queue
 */
function removeFromQueue(socket) {
  if (socket.chatType === "text") {
    if (textWaitingUser && textWaitingUser.id === socket.id) {
      textWaitingUser = null;
    }
  } else {
    if (videoWaitingUser && videoWaitingUser.id === socket.id) {
      videoWaitingUser = null;
    }
  }
}

/**
 * Try to match current user with waiting user of same chat type
 */
function matchUser(socket, chatType = "video") {
  socket.chatType = chatType;
  const waitingUser = chatType === "text" ? textWaitingUser : videoWaitingUser;
  
  if (waitingUser && waitingUser.id !== socket.id) {
    const partner = waitingUser;
    if (chatType === "text") {
      textWaitingUser = null;
    } else {
      videoWaitingUser = null;
    }
    return partner;
  }
  return null;
}

module.exports = {
  addToQueue,
  removeFromQueue,
  matchUser,
};
