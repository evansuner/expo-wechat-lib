import React, { useState } from "react";
import { Button, View, Text } from "react-native";
import {
  registerApp,
  isWechatInstalled,
  sendAuthRequest,
} from "expo-wechat-lib";

export default function App() {
  const [status, setStatus] = useState(
    "Native module loaded. Replace example credentials before testing WeChat."
  );
  const check = async () => {
    try {
      await registerApp({
        appid: "wx1234567890abcdef",
        universalLink: "https://example.com/wechat/",
      });
      setStatus(`WeChat installed: ${await isWechatInstalled()}`);
    } catch (error) {
      setStatus(String(error));
    }
  };
  const login = async () => {
    try {
      await check();
      const result = await sendAuthRequest({
        scope: "snsapi_userinfo",
        state: "replace-with-server-nonce",
      });
      setStatus(`Auth response: ${result.errorCode}`);
    } catch (error) {
      setStatus(String(error));
    }
  };
  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
      <Text>{status}</Text>
      <Button title="Register and check WeChat" onPress={check} />
      <Button title="Authorize with WeChat" onPress={login} />
    </View>
  );
}
