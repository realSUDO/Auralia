const queueCommand = require("./queue");

module.exports = {
  name: "q",
  description: "Alias for queue command",
  execute(message, args, client) {
    return queueCommand.execute(message, args, client);
  },
};
