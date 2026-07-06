import { BaseVaervaktAction, vaervaktAction } from "./base-vaervakt-action";

@vaervaktAction("no.vaervakt.streamdeck.bath-info")
export class BathInfoAction extends BaseVaervaktAction {
  constructor() {
    super("bathInfo");
  }
}
