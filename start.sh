#!/bin/bash
# Force IPv4 DNS resolution for Discord voice
export NODE_OPTIONS="--dns-result-order=ipv4first"
npm start
