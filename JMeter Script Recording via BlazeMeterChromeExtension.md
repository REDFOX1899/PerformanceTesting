### 🔰 Introduction

[BlazeMeter Chrome Extension](https://chrome.google.com/webstore/detail/blazemeter-the-continuous/mbopgmdnpcbohhpnfglgohlbhfongabi) is a **free tool** to record and run performance tests. It supports:

* Exporting scripts in `.jmx`, `.json`, or `.yml` format.
* Uploading and running scripts directly from your browser.
* Recording **HTTP/S traffic** automatically.

---

## 🚦 Steps to Record JMeter Scripts

---

### 1. 🎯 Create a Basic Test Plan in JMeter

1. Open **JMeter**
2. Right-click on `Test Plan` > `Add` > `Threads (Users)` > `Thread Group`
3. Configure the `Thread Group`:

   * **Number of Threads (Users)**: `100`
   * **Ramp-Up Period (seconds)**: `2`
   * **Loop Count**: `1`

---

### 2. 🔌 Install BlazeMeter Chrome Extension

* Visit: [Add BlazeMeter to Chrome](https://chrome.google.com/webstore/detail/blazemeter-the-continuous/mbopgmdnpcbohhpnfglgohlbhfongabi)
* Click: `Add to Chrome`

Once added, you’ll see the BlazeMeter icon in your Chrome toolbar.

---

### 3. 👤 Login or Sign Up on BlazeMeter

* Click the **BlazeMeter extension icon**
* Login with your existing account, or sign up if you don’t have one
* Once logged in, you can start recording

---

### 4. 🎬 Start Script Recording

1. Click the BlazeMeter icon → Enter a **Test Name**
2. Click `Start Recording`
3. Interact with your website/application
4. Use `Pause` or `Stop` when done
5. Click **Save** and download the recording in `.jmx` format

---

### 5. 📥 Import Recording into JMeter

* Open JMeter
* Go to `File` > `Open`
* Select the downloaded `.jmx` file
* You’ll now see the **HTTP Request Samplers** and full test structure

---

## ✅ Summary

BlazeMeter Chrome Extension simplifies test script recording for JMeter by:

* Automatically capturing real-world browser traffic
* Generating `.jmx` files ready for JMeter
* Helping testers without deep JMeter knowledge to get started quickly

© 2025 – Load Testing Tools & Resources
*Free tools, tutorials, and monitoring for developers, QA, DevOps, and performance engineers.*

---

Would you like me to combine this with the Homebrew installation content into a single landing page or split into multiple sections? I can also generate a Jekyll-compatible GitHub Pages site layout if you're ready to publish.
