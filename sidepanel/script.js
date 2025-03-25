document.addEventListener('DOMContentLoaded', () => {
  const button = document.getElementById('sendMessageButton');
  if (button) {
    button.addEventListener('click', () => {
      chrome.runtime.sendMessage({
        action: "refresh_side_panel"
      });
      console.log("Message sent to refresh side panel");
    });
  } else {
    console.error("Element with ID 'sendMessageButton' not found.");
  }
});
