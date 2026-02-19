const skipCommand = require("./skip");

module.exports = {
  name: "next",
  description: "Alias for skip command",
  execute(message, args, client) {
    return skipCommand.execute(message, args, client);
  },
};
