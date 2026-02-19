const previousCommand = require("./previous");

module.exports = {
  name: "prev",
  description: "Alias for previous command",
  execute(message, args, client) {
    return previousCommand.execute(message, args, client);
  },
};
