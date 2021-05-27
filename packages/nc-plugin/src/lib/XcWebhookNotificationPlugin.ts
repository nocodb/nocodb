import XcPlugin from "./XcPlugin";
import {IWebhookNotificationAdapter} from "../index";

abstract class XcStoragePlugin extends XcPlugin {

  abstract getAdapter(): IWebhookNotificationAdapter

}


export default XcStoragePlugin;
