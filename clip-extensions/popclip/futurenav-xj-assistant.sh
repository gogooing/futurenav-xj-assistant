send_text() {
    curl -d "$POPCLIP_TEXT" --unix-socket /tmp/futurenav-xj-assistant.sock http://futurenav-xj-assistant
}

if ! send_text; then
    open -g -a 晓君助手
    sleep 2
    send_text
fi
