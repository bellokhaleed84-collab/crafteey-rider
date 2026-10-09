package com.crafteey.rider;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(OverlayPermissionPlugin.class);
        registerPlugin(RiderBubblePlugin.class);
        super.onCreate(savedInstanceState);
    }

    // App on screen: hide the bubble. App left: show it (if online).
    @Override
    public void onStart() {
        super.onStart();
        BubbleService.setAppInBackground(false);
    }

    @Override
    public void onStop() {
        super.onStop();
        BubbleService.setAppInBackground(true);
    }
}