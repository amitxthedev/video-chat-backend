let waitingUser = null;

/**
 * Add user to waiting queue
 */
function addToQueue(socket) {
  waitingUser = socket;
}

/**
 * Remove user from waiting queue
 */
function removeFromQueue(socket) {
  if (waitingUser && waitingUser.id === socket.id) {
    waitingUser = null;
  }
}

/**
 * Try to match current user with waiting user
 */
function matchUser(socket) {
  if (waitingUser && waitingUser.id !== socket.id) {
    const partner = waitingUser;
    waitingUser = null;
    return partner;
  }
  return null;
}

module.exports = {
  addToQueue,
  removeFromQueue,
  matchUser,
};
