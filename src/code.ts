import Color from "color";

// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).

// This shows the HTML page in "ui.html".
figma.showUI(__html__, {
  themeColors: true,
  height: 800,
  width: 1000
});

// Calls to "parent.postMessage" from within the HTML page will trigger this
// callback. The callback will be passed the "pluginMessage" property of the
// posted message.

let globalConfig: { [x: string]: string } = {};
const formatter = new Intl.NumberFormat('en-US', {
  style: 'decimal',
  maximumFractionDigits: 5,
  minimumFractionDigits: 0,
})

const getHexValue = (value: RGB) => {
  const rgbValue: RGB = figma.util.rgb(value);

  const myColor = Color(rgbValue as { [key: string]: any });
  return myColor.hex();
}

const getRGBAValue = (value: RGBA) => {
  const rgbaValue: RGBA = figma.util.rgba(value);
  return `rgba(${rgbaValue.r},${rgbaValue.g},${rgbaValue.b},${rgbaValue.a})`
}

const formatValue = (value: number) => {
  const remVal: number = value / 16;
  const rounded = formatter.format(remVal);
  return globalConfig.unit === 'rem' ? `${rounded}rem` : `${value}px`
}

const SCOPE_TYPES: {
  [k in VariableScope]?: string
} = {
  FONT_FAMILY: 'fontFamily',
  FONT_STYLE: 'fontStyle',
  FONT_WEIGHT: 'fontWeight',
  FONT_SIZE: 'fontSize',
  LINE_HEIGHT: 'fontSize',
  LETTER_SPACING: 'fontSize',
  PARAGRAPH_SPACING: 'fontSize',
  GAP: 'fontSize',
  CORNER_RADIUS: 'fontSize'
}

type TOKEN_PRESENTERS =
  | 'color'
  | 'shadow'
  | 'animation'
  | 'border'
  | 'borderRadius'
  | 'easing'
  | 'fontFamily'
  | 'fontSize'
  | 'fontWeight'
  | 'letterSpacing'
  | 'lineHeight'
  | 'opacity'
  | 'spacing';

const TOKEN_TYPE: {
  [k in VariableScope]?: TOKEN_PRESENTERS
} = {
  CORNER_RADIUS: 'borderRadius',
  WIDTH_HEIGHT: 'spacing',
  GAP: 'spacing',
  ALL_FILLS: 'color',
  FRAME_FILL: 'color',
  SHAPE_FILL: 'color',
  TEXT_FILL: 'color',
  STROKE_COLOR: 'color',
  STROKE_FLOAT: 'border',
  EFFECT_COLOR: 'color',
  OPACITY: 'opacity',
  FONT_FAMILY: "fontFamily",
  FONT_STYLE: "fontWeight",
  FONT_WEIGHT: "fontWeight",
  FONT_SIZE: "fontSize",
  LINE_HEIGHT: "lineHeight",
  LETTER_SPACING: "letterSpacing",
}

const FONT_WEIGHT_MAP: { [x: string]: number } = {
  'Regular': 400,
  'Medium': 500,
  'Semi Bold': 600,
  'Bold': 700
}

const getVariableType = (variableScopes: VariableScope[]) => {
  if (variableScopes.some(scope => scope === 'FONT_FAMILY')) {
    return SCOPE_TYPES.FONT_FAMILY;
  }

  if (variableScopes.some(scope => scope === "FONT_STYLE" || scope === "FONT_WEIGHT")) {
    return SCOPE_TYPES.FONT_WEIGHT;
  }

  if (variableScopes.some(scope => scope === "FONT_SIZE")) {
    return SCOPE_TYPES.FONT_SIZE;
  }

  return SCOPE_TYPES[variableScopes[0]];
}

const getTokenPresenter = (variableScopes: VariableScope[], type?: string) => {
  const scope = variableScopes[0];
  let tokenType = TOKEN_TYPE[scope];

  if (type === 'color') {
    tokenType = 'color';
  }

  return tokenType || scope;

}

const getCollectionVariables = async (collection: VariableCollection, variables: Variable[], modeMap: { [x: string]: string }) => {
  if (collection) {
    const modes = collection.modes;
    const singleMode = modes.length === 1;
    const currentVariables = variables
      .filter((variable: Variable) => variable.variableCollectionId === collection.id);

    let variablesMyMode: { [x: string]: any } = {};

    for (var j = 0; j < modes.length; j++) {
      const mode = modes[j];

      const variableObject: { [x: string]: any } = {};

      for (var i = 0; i < currentVariables.length; i++) {
        const variable = currentVariables[i];
        const variableScopes = variable.scopes;
        let value = variable.valuesByMode[mode.modeId];
        let type = getVariableType(variableScopes);

        // Get Alias value if the value is VariableAlias
        const aliasValue = value as VariableAlias;
        let valueType;

        if (aliasValue.type === "VARIABLE_ALIAS") {
          const variableObj = await figma.variables.getVariableByIdAsync(aliasValue.id);

          if (variableObj) {
            // Get value from current mode
            value = variableObj?.valuesByMode[mode.modeId];

            // if value doesn't exist in current mode
            if (value === undefined) {
              // check for primitive variable reference
              const aliasMode = Object.keys(variableObj.valuesByMode || {})[0];
              const aliasCollectionName = modeMap[aliasMode];
              value = `{${variableObj.name}.value}`;
              valueType = 'ALIAS_REF';
            }
          }
        }

        // Get Hex value if the value type is Color
        if (variable.resolvedType === 'COLOR' && valueType !== 'ALIAS_REF') {
          // value = globalConfig.color === 'rgba' ? getRGBAValue(value as RGBA) : getHexValue(value as RGB);
          type = 'color';
          const { r, g, b, a } = value as RGBA;

          // get 255-bit rgba object
          value = {
            r: r * 255,
            g: g * 255,
            b: b * 255,
            a: a
          }
        }

        // Not required - formatting done on styledictionary end
        /* Get rounded of Rem value if the value is number
          if (variable.resolvedType === 'FLOAT' && typeof value === 'number') {
            // value = formatValue(value);
            // type = 'fontSize';
          }
        */

        if (type === SCOPE_TYPES.FONT_WEIGHT) {
          value = FONT_WEIGHT_MAP[value as string];
        }

        const tokenType = getTokenPresenter(variableScopes, type);

        variableObject[variable.name] = { value, type, tokenType };
      };

      if (singleMode) {
        variablesMyMode = { ...variablesMyMode, ...variableObject };
      } else {
        variablesMyMode[mode.name] = variableObject;
      }

    }
    return variablesMyMode;
  }

  return {};
}

const getLocalCollections = async () => {
  const localCollections = await figma.variables.getLocalVariableCollectionsAsync();
  const localVariables = await figma.variables.getLocalVariablesAsync();
  const modeArr = localCollections.flatMap(collection => collection.modes.map(mode => ({ [mode.modeId]: collection.name })))
  const modeMap = modeArr.reduce((acc, modeObj) => ({ ...acc, ...modeObj }), {});
  let mergedData: { [x: string]: any } = {};

  let baseTokens: { [x: string]: any } = {};
  let themeTokens: { [x: string]: any }[] = [];

  for (let i = 0; i < localCollections.length; i++) {
    const collection = localCollections[i];

    const variables = await getCollectionVariables(collection, localVariables, modeMap);

    if (collection.modes.length > 1) {
      themeTokens.push(variables);
    }

    if (collection.modes.length === 1) {
      baseTokens = { ...baseTokens, ...variables };
    }
    mergedData = { ...mergedData, ...variables }
  }

  const tokensForExport = themeTokens.reduce((acc, collection) => ({ ...acc, ...collection }), {});

  // console.log('Theme tokens generated', tokensForExport);

  figma.ui.postMessage({
    type: 'baseTokens',
    data: JSON.stringify(baseTokens, undefined, 4)
  });

  figma.ui.postMessage({
    type: 'themeTokens',
    data: tokensForExport
  });

  figma.ui.postMessage({
    type: 'mergedTokens',
    data: JSON.stringify(mergedData, undefined, 4)
  });
}

figma.ui.onmessage = async (msg: { type: string, config: { [x: string]: string } }) => {
  // One way of distinguishing between different types of messages sent from
  // your HTML page is to use an object with a "type" property like this.
  if (msg.type === 'run') {
    globalConfig = msg.config;
    await Promise.all([getLocalCollections()]);
  }

  if (msg.type === 'cancel') {
    // Make sure to close the plugin when you're done. Otherwise the plugin will
    // keep running, which shows the cancel button at the bottom of the screen.
    figma.closePlugin();
  }

};