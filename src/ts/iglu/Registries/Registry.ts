import { Validator } from "jsonschema";
import { default as m, redraw, ClassComponent, Vnode } from "mithril";

import { IgluSchema, ResolvedIgluSchema } from "../IgluSchema";
import { RegistrySpec, RegistryStatus } from "../../types";
import { request } from "../../permissions";
import { uuidv4 } from "../../util";

const kindFieldOptions: { [name: string]: RegistrySpec["kind"] } = {
  Local: "local",
  "Data Structures API": "ds",
  "Static HTTP": "static",
  "Iglu Server/Mini API": "iglu",
};

type OptFields = {
  [opt: string]: {
    description?: string;
    required: boolean;
    title: string;
    type: string;
    placeholder?: string;
    pattern?: string;
    default?: any;
  };
};

export abstract class Registry implements ClassComponent {
  id: string;
  spec: RegistrySpec;
  priority?: number;
  vendorPrefixes?: string[];
  opts: { [prop: string]: any };
  lastStatus?: RegistryStatus;
  validator: Validator;
  fields: OptFields = {};
  updated: boolean = false;

  private walkLock?: ReturnType<Registry["walk"]>;

  constructor(spec: RegistrySpec) {
    const { id, name, kind, priority, vendorPrefixes, ...opts } = spec;
    this.id = id || uuidv4();
    this.spec = { ...spec, id: this.id };

    this.priority = priority;
    this.vendorPrefixes = vendorPrefixes;

    this.opts = opts;
    this.validator = new Validator();
  }

  toJSON() {
    return { ...this.spec, ...(this.opts || {}) };
  }

  view(vnode: Vnode<any>) {
    if (
      typeof vnode.attrs.editing === "undefined" ||
      vnode.attrs.editing === false
    ) {
      return m(
        "option",
        {
          className: `registry ${this.spec.kind} ${
            this.lastStatus ? this.lastStatus.toLowerCase() : ""
          }`,
          value: this.spec.id,
        },
        this.spec.name
      );
    } else {
      return m(
        "fieldset.box",
        { name: this.id },
        m("input.input[type=hidden][name=id][readonly]", { value: this.id }),
        m(
          "label.label",
          { title: "Name for this registry. Used only in the extension" },
          "Name",
          m("input.input[type=text][name=name][required][pattern=.+]", {
            value: this.spec.name,
          })
        ),
        m("label.label", "Kind"),
        m(
          "div.select",
          {
            title:
              "The type of Registry this is. Determines which API or request format is used to access schemas",
          },
          m(
            "select[name=kind]",
            { value: this.spec.kind },
            Object.entries(kindFieldOptions).map(([name, kind]) =>
              m(
                "option",
                { value: kind, selected: kind == this.spec.kind },
                name
              )
            )
          )
        ),
        Object.entries(this.fields).map(
          ([field, { title, type, description, required, pattern }]) =>
            m(
              "label.label",
              title,
              m("input.input", {
                name: field,
                pattern,
                required,
                title: description,
                type,
                value: this.opts[field],
              })
            )
        ),
        m(
          "label.label",
          {
            title:
              "Priority, lower is higher. Not used by the extension, which prefers the fastest registry configured",
          },
          "Priority",
          m("input.input[type=number][name=priority][min=0]", {
            value: this.priority || 0,
          })
        ),
        m(
          "label.label",
          {
            title:
              "Vendor prefixes, for preferring registries for particular schema lookups. Not used in the extension",
          },
          "Vendor Prefixes",
          m("textarea.textarea[name=vendorPrefixes]", {
            size: Math.min(
              5,
              this.vendorPrefixes ? this.vendorPrefixes.length : 1
            ),
            value: (this.vendorPrefixes || []).join("\n"),
          })
        ),
        m(
          "label.label",
          {
            title: "Current status of the registry",
            for: "registry-status",
          },
          "Status",
          m(
            "output[name=registry-status]",
            {
              title: this.opts.statusReason,
            },
            `${this.lastStatus || "UNCERTAIN"} (${
              vnode.attrs.schemaCount || 0
            } schemas) `
          )
        )
      );
    }
  }

  protected requestPermissions(...origins: string[]): Promise<void> {
    return request(...origins);
  }

  walk(): ReturnType<Registry["_walk"]> {
    if (this.walkLock) return this.walkLock;
    return (this.walkLock = this._walk().finally(
      () => (this.walkLock = undefined)
    ));
  }

  abstract resolve(_: IgluSchema): Promise<ResolvedIgluSchema>;
  abstract status(): Promise<RegistryStatus>;
  abstract _walk(): Promise<IgluSchema[]>;
}
