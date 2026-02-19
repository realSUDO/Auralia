const { EmbedBuilder } = require("discord.js");

/**
 * Create success embed - minimal and clean
 */
function createSuccessEmbed(message) {
	return new EmbedBuilder()
		.setDescription(message)
		.setColor(0x57f287); // Discord green
}

/**
 * Create error embed - minimal and clean
 */
function createErrorEmbed(message) {
	return new EmbedBuilder()
		.setDescription(message)
		.setColor(0xed4245); // Discord red
}

/**
 * Create info embed - minimal and clean
 */
function createInfoEmbed(message) {
	return new EmbedBuilder()
		.setDescription(message)
		.setColor(0x5865f2); // Discord blurple
}

/**
 * Create warning embed - minimal and clean
 */
function createWarningEmbed(message) {
	return new EmbedBuilder()
		.setDescription(message)
		.setColor(0xfee75c); // Discord yellow
}

module.exports = {
	createSuccessEmbed,
	createErrorEmbed,
	createInfoEmbed,
	createWarningEmbed,
};
