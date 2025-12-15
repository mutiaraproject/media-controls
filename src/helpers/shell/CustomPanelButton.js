/**
 * Brighten a color by a multiplier
 * @param {string} rgbColor - Color in format "rgb(r, g, b)"
 * @param {number} multiplier - Brightness multiplier (1.0 = no change, 2.0 = twice as bright)
 * @returns {string} Brightened color
 */
function brightenColor(rgbColor, multiplier) {
    const match = rgbColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return rgbColor;
    
    let r = parseInt(match[1]);
    let g = parseInt(match[2]);
    let b = parseInt(match[3]);
    
    // Apply brightness multiplier and clamp to 255
    r = Math.min(255, Math.round(r * multiplier));
    g = Math.min(255, Math.round(g * multiplier));
    b = Math.min(255, Math.round(b * multiplier));
    
    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Blend a color with another base color to create a tinted effect
 * @param {string} rgbColor - Color in format "rgb(r, g, b)"
 * @param {number} opacity - How much of the color to use (0.0 = base color, 1.0 = full color)
 * @param {string} baseColor - Base color to blend with (default white)
 * @returns {string} Blended color in format "rgb(r, g, b)"
 */
function blendColors(rgbColor, opacity, baseColor = 'rgb(255, 255, 255)') {
    // Parse RGB values from source color
    const match = rgbColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return rgbColor;
    
    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    
    // Parse base color
    const baseMatch = baseColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!baseMatch) return rgbColor;
    
    const baseR = parseInt(baseMatch[1]);
    const baseG = parseInt(baseMatch[2]);
    const baseB = parseInt(baseMatch[3]);
    
    // Blend colors
    const blendedR = Math.round(r * opacity + baseR * (1 - opacity));
    const blendedG = Math.round(g * opacity + baseG * (1 - opacity));
    const blendedB = Math.round(b * opacity + baseB * (1 - opacity));
    
    return `rgb(${blendedR}, ${blendedG}, ${blendedB})`;
}

/**
 * Update label colors based on album art color
 * @param {any} panelButton 
 * @param {string} albumArtColor 
 */
function updateLabelColors(panelButton, albumArtColor) {
    if (!panelButton.buttonLabel) return;
    
    if (CONFIG.enableDebug) {
        debugLog("Updating label colors with:", albumArtColor);
    }
    
    // Handle scrolling label
    if (panelButton.buttonLabel.label) {
        if (CONFIG.enableTitleColorTint) {
            const tintedColor = blendColors(albumArtColor, CONFIG.titleTintOpacity);
            panelButton.buttonLabel.label.set_style(`color: ${tintedColor} !important;`);
            if (CONFIG.enableDebug) {
                debugLog("Applied scrolling label color:", tintedColor);
            }
        }
    } else {
        // Handle individual styled labels
        const children = panelButton.buttonLabel.get_children();
        for (const child of children) {
            const styleClass = child.get_style_class_name();
            
            if (styleClass && styleClass.includes('panel-label-title') && CONFIG.enableTitleColorTint) {
                const tintedColor = blendColors(albumArtColor, CONFIG.titleTintOpacity);
                child.set_style(`color: ${tintedColor} !important;`);
                if (CONFIG.enableDebug) {
                    debugLog("Applied title color:", tintedColor);
                }
            } else if (styleClass && styleClass.includes('panel-label-artist') && CONFIG.enableArtistColorTint) {
                // Blend with #aaaaaa instead of white for darker tint
                const tintedColor = blendColors(albumArtColor, CONFIG.artistTintOpacity, 'rgb(170, 170, 170)');
                child.set_style(`color: ${tintedColor} !important;`);
                if (CONFIG.enableDebug) {
                    debugLog("Applied artist color:", tintedColor);
                }
            }
        }
    }
}

/**
 * Calculate the average color from a pixbuf
 * @param {GdkPixbuf.Pixbuf} pixbuf 
 * @returns {string} RGB color in format "rgb(r, g, b)"
 */
function calculateAverageColor(pixbuf) {
    const pixels = pixbuf.get_pixels();
    const hasAlpha = pixbuf.get_has_alpha();
    const rowstride = pixbuf.get_rowstride();
    const width = pixbuf.get_width();
    const height = pixbuf.get_height();
    const channels = hasAlpha ? 4 : 3;
    
    let totalR = 0, totalG = 0, totalB = 0, count = 0;
    
    // Sample every 4th pixel for performance (you can adjust this)
    const step = 4;
    
    for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
            const offset = y * rowstride + x * channels;
            const r = pixels[offset];
            const g = pixels[offset + 1];
            const b = pixels[offset + 2];
            
            totalR += r;
            totalG += g;
            totalB += b;
            count++;
        }
    }
    
    const avgR = Math.round(totalR / count);
    const avgG = Math.round(totalG / count);
    const avgB = Math.round(totalB / count);
    
    return `rgb(${avgR}, ${avgG}, ${avgB})`;
}

/**
 * CustomPanelButton.js
 * 
 * Custom modifications for Media Controls extension
 * This file adds album art support and custom label styling
 * Place this file in: ~/.local/share/gnome-shell/extensions/mediacontrols@cliffniff.github.com/helpers/shell/
 */

import GdkPixbuf from "gi://GdkPixbuf";
import Cogl from "gi://Cogl";
import St from "gi://St";
import Clutter from "gi://Clutter";
import Gio from "gi://Gio";
import { gettext as _ } from "resource:///org/gnome/shell/extensions/extension.js";

import { debugLog } from "../../utils/common.js";
import { getAppByIdAndEntry, getImage } from "../../utils/shell_only.js";
import { LabelTypes, PlaybackStatus } from "../../types/enums/common.js";
import ScrollingLabel from "./ScrollingLabel.js";

/**
 * Configuration - Change these values to customize
 */
const CONFIG = {
    // Album art size in pixels (16, 20, 24, 28, etc.)
    albumArtSize: 14,
    
    // Album art border radius in pixels
    albumArtBorderRadius: 0,
    
    // Enable glow effect around album art based on its colors
    enableAlbumArtGlow: true,
    glowRadius: 20,
    glowBrightness: 1.7,  // More than double brightness
    glowLayers: 4,        // More layers = more intense
    
    // Glow radius in pixels (only if enableAlbumArtGlow is true)
    glowRadius: 8,
    
    // Enable colored background gradient in the button
    enableAlbumArtBackground: false,
    
    // Background gradient opacity (0.0 to 1.0)
    backgroundOpacity: 0.15,
    
    // Enable color tint on title label
    enableTitleColorTint: true,
    
    // Title color tint opacity (0.0 to 1.0) - how strong the color hint is
    titleTintOpacity: 0.3,
    
    // Enable color tint on artist label
    enableArtistColorTint: true,
    
    // Artist color tint opacity (0.0 to 1.0)
    artistTintOpacity: 0.25,
    
    // Enable debug logging for this module
    enableDebug: true,
};

/**
 * Custom addButtonIcon with album art support
 * 
 * @param {any} panelButton - The PanelButton instance
 * @param {number} index - Position index in the button box
 */
export function customAddButtonIcon(panelButton, index) {
    if (CONFIG.enableDebug) {
        debugLog("=== CUSTOM addButtonIcon START ===");
    }
    
    // 1. Setup the fallback icon
    const app = getAppByIdAndEntry(panelButton.playerProxy.identity, panelButton.playerProxy.desktopEntry);
    const fallbackIcon = app?.get_icon() ?? Gio.Icon.new_for_string("audio-x-generic-symbolic");
    const coloredClass = panelButton.extension.coloredPlayerIcon ? "colored-icon" : "symbolic-icon";
    
    // Create the widget with the fallback
    const icon = new St.Icon({
        gicon: fallbackIcon,
        styleClass: `system-status-icon no-margin ${coloredClass}`,
    });

    // 2. Add it to the panel
    if (panelButton.buttonIcon?.get_parent() === panelButton.buttonBox) {
        panelButton.buttonBox.replace_child(panelButton.buttonIcon, icon);
        panelButton.buttonIcon.destroy();
    } else {
        panelButton.buttonBox.insert_child_at_index(icon, index);
        if (CONFIG.enableDebug) {
            debugLog("Added fallback icon to panel");
        }
    }
    panelButton.buttonIcon = icon;

    // 3. Try to load album art
    const artUrl = panelButton.playerProxy?.metadata?.["mpris:artUrl"];
    
    if (artUrl) {
        if (CONFIG.enableDebug) {
            debugLog("Starting album art loading for:", artUrl);
        }
        
        (async () => {
            try {
                const stream = await getImage(artUrl);
                if (!stream) {
                    if (CONFIG.enableDebug) {
                        debugLog("No stream obtained");
                    }
                    return;
                }

                const pixbuf = await GdkPixbuf.Pixbuf.new_from_stream_async(stream, null);
                if (!pixbuf) {
                    if (CONFIG.enableDebug) {
                        debugLog("Pixbuf conversion failed");
                    }
                    return;
                }

                const iconSize = CONFIG.albumArtSize;
                const format = pixbuf.hasAlpha ? Cogl.PixelFormat.RGBA_8888 : Cogl.PixelFormat.RGB_888;
                const imageContent = St.ImageContent.new_with_preferred_size(iconSize, iconSize);
                const context = global.stage.context.get_backend().get_cogl_context();
                
                imageContent.set_bytes(context, pixbuf.pixelBytes, format, pixbuf.width, pixbuf.height, pixbuf.rowstride);

                // Replace icon with album art widget
                if (panelButton.buttonIcon === icon) {
                    // Calculate average color from the pixbuf
                    const avgColor = calculateAverageColor(pixbuf);
                    
                    if (CONFIG.enableDebug) {
                        debugLog("Album art average color:", avgColor);
                    }
                    
                    // Apply effects based on album art color
                    let artWidgetStyle = `width: ${iconSize}px; height: ${iconSize}px;`;
                    
                    // Add glow effect if enabled
                    if (CONFIG.enableAlbumArtGlow) {
                        // Create a more vibrant glow by:
                        // 1. Brightening the color
                        // 2. Using multiple shadow layers for intensity
                        const brightColor = brightenColor(avgColor, CONFIG.glowBrightness);
                        
                        // Multiple shadow layers create a more intense glow
                        const shadows = [];
                        for (let i = 1; i <= CONFIG.glowLayers; i++) {
                            const radius = (CONFIG.glowRadius / CONFIG.glowLayers) * i;
                            shadows.push(`0 0 ${radius}px ${brightColor}`);
                        }
                        
                        artWidgetStyle += ` box-shadow: ${shadows.join(', ')};`;
                    }
                    
                    const artWidget = new St.Bin({
                        styleClass: 'panel-button-icon',
                        style: artWidgetStyle,
                        xAlign: Clutter.ActorAlign.CENTER,
                        yAlign: Clutter.ActorAlign.CENTER,
                    });
                    
                    const artImage = new St.Widget({
                        content: imageContent,
                        style: `width: ${iconSize}px; height: ${iconSize}px; border-radius: ${CONFIG.albumArtBorderRadius}px;`,
                        xAlign: Clutter.ActorAlign.CENTER,
                        yAlign: Clutter.ActorAlign.CENTER,
                    });
                    
                    artWidget.set_child(artImage);
                    
                    // Store color for potential use elsewhere
                    artWidget._albumArtColor = avgColor;
                    
                    // Apply background color effect to button box if enabled
                    if (CONFIG.enableAlbumArtBackground && panelButton.buttonBox) {
                        const opacity = CONFIG.backgroundOpacity;
                        // Parse the rgb color and add alpha
                        const colorWithAlpha = avgColor.replace('rgb(', 'rgba(').replace(')', `, ${opacity})`);
                        const currentStyle = panelButton.buttonBox.get_style() || '';
                        panelButton.buttonBox.set_style(
                            `${currentStyle} background: linear-gradient(90deg, transparent, ${colorWithAlpha});`
                        );
                    }
                    
                    const parent = panelButton.buttonIcon.get_parent();
                    if (parent) {
                        const iconIndex = parent.get_children().indexOf(panelButton.buttonIcon);
                        parent.remove_child(panelButton.buttonIcon);
                        panelButton.buttonIcon.destroy();
                        parent.insert_child_at_index(artWidget, iconIndex);
                        panelButton.buttonIcon = artWidget;
                        
                        // Update labels with the new color
                        updateLabelColors(panelButton, avgColor);
                        
                        if (CONFIG.enableDebug) {
                            debugLog("✓ Album art applied successfully!");
                        }
                    }
                }
            } catch (e) {
                if (CONFIG.enableDebug) {
                    debugLog("ERROR loading album art:", e);
                }
            }
        })();
    }
    
    if (CONFIG.enableDebug) {
        debugLog("=== CUSTOM addButtonIcon END ===");
    }
}

/**
 * Custom addButtonLabel with styled elements
 * 
 * @param {any} panelButton - The PanelButton instance
 * @param {number} index - Position index in the button box
 */
export function customAddButtonLabel(panelButton, index) {
    // Get the album art color if available
    const albumArtColor = panelButton.buttonIcon?._albumArtColor || null;
    
    // If scrolling is enabled, use the original simple approach
    if (panelButton.extension.scrollLabels) {
        const fullText = getButtonLabelText(panelButton);
        const scrollingLabel = new ScrollingLabel({
            text: fullText,
            width: panelButton.extension.labelWidth,
            isFixedWidth: panelButton.extension.isFixedLabelWidth,
            isScrolling: true,
            initPaused: panelButton.playerProxy.playbackStatus !== PlaybackStatus.PLAYING,
            scrollSpeed: panelButton.extension.scrollSpeed,
        });
        
        scrollingLabel.label.add_style_class_name('panel-label-text');
        
        if (panelButton.buttonLabel?.get_parent() === panelButton.buttonBox) {
            panelButton.buttonBox.replace_child(panelButton.buttonLabel, scrollingLabel);
            panelButton.buttonLabel.destroy();
        } else {
            panelButton.buttonBox.insert_child_at_index(scrollingLabel, index);
            debugLog("Added scrolling label");
        }
        panelButton.buttonLabel = scrollingLabel;
        
        // Apply color if available
        if (albumArtColor) {
            updateLabelColors(panelButton, albumArtColor);
        }
    } else {
        // No scrolling - use rich text with individual styled elements
        const labelBox = new St.BoxLayout({
            styleClass: 'panel-label-container',
            vertical: false,
        });
        
        for (const labelElement of panelButton.extension.labelsOrder) {
            let text = '';
            let styleClass = '';
            
            if (LabelTypes[labelElement] === LabelTypes.TITLE) {
                text = panelButton.playerProxy.metadata["xesam:title"] || '';
                styleClass = 'panel-label-title';
            } else if (LabelTypes[labelElement] === LabelTypes.ARTIST) {
                text = panelButton.playerProxy.metadata["xesam:artist"]?.join(", ") || _("Unknown artist");
                styleClass = 'panel-label-artist';
            } else if (LabelTypes[labelElement] === LabelTypes.ALBUM) {
                text = panelButton.playerProxy.metadata["xesam:album"] || _("Unknown album");
                styleClass = 'panel-label-album';
            } else if (LabelTypes[labelElement] === LabelTypes.DISC_NUMBER) {
                text = panelButton.playerProxy.metadata["xesam:discNumber"] || '';
                styleClass = 'panel-label-disc';
            } else if (LabelTypes[labelElement] === LabelTypes.TRACK_NUMBER) {
                text = panelButton.playerProxy.metadata["xesam:trackNumber"] || '';
                styleClass = 'panel-label-track';
            } else {
                text = labelElement;
                styleClass = 'panel-label-separator';
            }
            
            if (text) {
                const label = new St.Label({
                    text: text.replace(/[\r\n]+/g, " "),
                    styleClass: styleClass,
                    yAlign: Clutter.ActorAlign.CENTER,
                });
                labelBox.add_child(label);
            }
        }
        
        if (panelButton.extension.labelWidth > 0 && panelButton.extension.isFixedLabelWidth) {
            labelBox.width = panelButton.extension.labelWidth;
            labelBox.set_style(`max-width: ${panelButton.extension.labelWidth}px;`);
        }
        
        if (panelButton.buttonLabel?.get_parent() === panelButton.buttonBox) {
            panelButton.buttonBox.replace_child(panelButton.buttonLabel, labelBox);
            panelButton.buttonLabel.destroy();
        } else {
            panelButton.buttonBox.insert_child_at_index(labelBox, index);
            debugLog("Added styled label");
        }
        panelButton.buttonLabel = labelBox;
        
        // Apply colors if available
        if (albumArtColor) {
            updateLabelColors(panelButton, albumArtColor);
        }
    }
}

/**
 * Helper function to get button label text
 * @param {any} panelButton 
 * @returns {string}
 */
function getButtonLabelText(panelButton) {
    const labelTextElements = [];
    for (const labelElement of panelButton.extension.labelsOrder) {
        if (LabelTypes[labelElement] === LabelTypes.TITLE) {
            labelTextElements.push(panelButton.playerProxy.metadata["xesam:title"]);
        } else if (LabelTypes[labelElement] === LabelTypes.ARTIST) {
            labelTextElements.push(panelButton.playerProxy.metadata["xesam:artist"]?.join(", ") || _("Unknown artist"));
        } else if (LabelTypes[labelElement] === LabelTypes.ALBUM) {
            labelTextElements.push(panelButton.playerProxy.metadata["xesam:album"] || _("Unknown album"));
        } else if (LabelTypes[labelElement] === LabelTypes.DISC_NUMBER) {
            labelTextElements.push(panelButton.playerProxy.metadata["xesam:discNumber"]);
        } else if (LabelTypes[labelElement] === LabelTypes.TRACK_NUMBER) {
            labelTextElements.push(panelButton.playerProxy.metadata["xesam:trackNumber"]);
        } else {
            labelTextElements.push(labelElement);
        }
    }
    return labelTextElements.join(" ").replace(/[\r\n]+/g, " ");
}
