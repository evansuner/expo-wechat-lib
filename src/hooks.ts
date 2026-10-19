import { useEffect, useState } from "react";

import { isWechatInstalled } from "./api";

export const useWechatInstalled = () => {
  const [hasInstalledWechat, setHasInstalledWechat] = useState(false);

  useEffect(() => {
    isWechatInstalled()
      .then(setHasInstalledWechat)
      .catch(() => setHasInstalledWechat(false));
  }, []);

  return hasInstalledWechat;
};
